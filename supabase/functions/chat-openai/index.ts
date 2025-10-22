// deno-lint-ignore-file no-explicit-any
// Edge Function: chat-openai
// Centraliza chamadas de chat/Responses com OpenAI no servidor (usa chave por organização via RPC)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Shim de tipos para o lint do IDE (Node/TS) reconhecer o objeto Deno em tempo de edição.
// Isso não afeta a execução na Edge Function (que já fornece Deno no runtime).
declare const Deno: {
  env: { get(key: string): string | undefined }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ChatRequest = {
  organization_id?: string | null;
  agent_id: string;
  model?: string;
  temperature?: number;
  system?: string;
  history: Array<{ role: 'user'|'assistant'|'system'; content: string }>;
  use_vector_store?: boolean;
  vector_store_id?: string | null;
  debug_ok_errors?: boolean;
  assistant_id?: string | null;
  images?: string[]; // URLs assinadas de imagens para visão
};

serve(async (req) => {
  try {
    // CORS preflight handler (ecoar os headers solicitados pelo navegador)
    if (req.method === 'OPTIONS') {
      const reqHeaders = req.headers.get('Access-Control-Request-Headers') || 'authorization, x-client-info, apikey, content-type';
      const headers = { ...corsHeaders, 'Access-Control-Allow-Headers': reqHeaders } as Record<string, string>;
      return new Response('ok', { status: 200, headers });
    }

    // Flag de depuração controlado pelo payload (inicialmente falso)
    let debug_ok_errors = false;
    // Helper central para respostas JSON com CORS e, se debug ativo, forçar status 200 e embutir status original
    const sendJSON = (status: number, body: Record<string, any>) => {
      const effectiveStatus = debug_ok_errors && status !== 200 ? 200 : status;
      const b = debug_ok_errors && status !== 200 ? { ok: false, status, ...body } : body;
      return new Response(JSON.stringify(b), { status: effectiveStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    };

    if (req.method !== 'POST') {
      return sendJSON(405, { error: 'Method not allowed' });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return sendJSON(500, { error: 'Missing Supabase env' });
    }

    let payload: ChatRequest;
    let agent_id: string = '';
    let orgParam: string | null = null;
    let model: string | undefined = undefined;
    let temperature: number | undefined = undefined;
    let system: string | undefined = undefined;
    let history: Array<{ role: 'user'|'assistant'|'system'; content: string }> = [];
    let use_vector_store: boolean | undefined = undefined;
    let vector_store_id: string | null = null;
    let assistant_id: string | null = null;
    let images: string[] = [];

    try {
      payload = (await req.json().catch(() => ({}))) as ChatRequest;
      console.log('[chat-openai] Payload recebido:', JSON.stringify(payload, null, 2));
      // Atualiza o flag de depuração o quanto antes
      debug_ok_errors = payload?.debug_ok_errors === true;
      // Atribuições explícitas com coalescência para evitar tipos indefinidos
      agent_id = (payload?.agent_id || '').trim();
      orgParam = payload?.organization_id ?? null;
      model = payload?.model;
      temperature = payload?.temperature;
      system = payload?.system;
      history = Array.isArray(payload?.history) ? payload!.history : [];
      use_vector_store = payload?.use_vector_store === true;
      vector_store_id = payload?.vector_store_id ?? null;
      assistant_id = payload?.assistant_id ?? null;
      images = Array.isArray(payload?.images) ? (payload!.images as string[]).filter((u) => typeof u === 'string' && u.trim()) : [];

      if (!agent_id) {
        return sendJSON(400, { error: 'agent_id is required', received: payload });
      }
      if (!Array.isArray(history)) {
        return sendJSON(400, { error: 'history must be an array', received: history });
      }

    } catch (parseError: any) {
      return sendJSON(400, { error: 'Invalid JSON payload', details: parseError.message });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve organização pelo agente como fonte de verdade
    let orgId: string | null = null;
    try {
      const { data: ag } = await sb.from('agents').select('organization_id').eq('id', agent_id).single();
      orgId = (ag as any)?.organization_id || null;
    } catch {}
    if (!orgId) orgId = orgParam || null;

    // Busca chave por organização via RPC (fallback para OPENAI_API_KEY das Functions)
    let apiKey: string | null = null; let rpcErr: any = null;
    console.log('[chat-openai] Buscando API key para orgId:', orgId);
    if (orgId) {
      // Tentar primeiro com get_llm_api_key (nova função)
      try {
        const { data: adminData, error: adminError } = await sb.rpc('get_llm_api_key', { 
          p_org_id: orgId, 
          p_provider: 'openai' 
        });
        if (!adminError && adminData) {
          apiKey = (adminData as string) || null;
          console.log('[chat-openai] API key obtida via get_llm_api_key');
        } else {
          console.log('[chat-openai] get_llm_api_key falhou, tentando get_llm_secret:', adminError?.message);
        }
      } catch (e) {
        console.log('[chat-openai] Erro ao chamar get_llm_api_key:', e);
      }
      
      // Fallback para get_llm_secret (função antiga)
      if (!apiKey) {
        const { data, error } = await sb.rpc('get_llm_secret', { p_org: orgId, p_provider: 'openai' });
        apiKey = (data as string) || null;
        rpcErr = error || null;
        console.log('[chat-openai] API key via get_llm_secret:', apiKey ? 'encontrada' : 'não encontrada', 'erro:', rpcErr?.message);
      }
    }
    if (!apiKey) {
      const envKey = Deno.env.get('OPENAI_API_KEY') || '';
      if (envKey) {
        apiKey = envKey;
        console.log('[chat-openai] Usando API key do ambiente');
      }
    }
    if (!apiKey) {
      const why = rpcErr ? `rpc error: ${rpcErr.message || rpcErr}` : `no key via RPC; orgId used: ${orgId ?? 'null'}`;
      console.error('[chat-openai] API key não configurada:', why);
      return sendJSON(400, { error: `OpenAI API Key not configured (${why})` });
    }
    console.log('[chat-openai] API key configurada com sucesso, primeiro caractere:', apiKey?.charAt(0));

    const mdl = model || 'gpt-4o-mini';
    const temp = Number.isFinite(temperature as number) ? Math.min(2, Math.max(0, Number(temperature))) : 0.7;
    console.log('[chat-openai] Modelo:', mdl, 'temperatura:', temp, 'tamanho do histórico:', history.length);

    // Monta input como texto (compatível com Responses API)
    const sys = (system || '').trim();
    const parts: string[] = [];
    if (sys) parts.push(`system: ${sys}`);
    for (const m of history) {
      const role = m.role === 'system' ? 'user' : m.role;
      parts.push(`${role}: ${m.content || ''}`);
    }
    const input_text = parts.join('\n');

    // Caminho multimodal: sempre que houver imagens, usa Responses API com partes image_url
    if (images.length > 0) {
      try {
        console.log('[chat-openai] Multimodal: images recebidas:', images.length);
        // Força um modelo "vision" se o informado não suportar imagens
        const lower = String(mdl || '').toLowerCase();
        const isVision = lower.includes('gpt-4o') || lower.includes('vision') || lower.includes('mini') || lower.includes('omni');
        const visionModel = isVision ? mdl : 'gpt-4o-mini';
        const body = {
          model: visionModel,
          temperature: temp,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: input_text || (history.at(-1)?.content || '') },
                ...images.map((url) => ({ type: 'input_image', image_url: url }))
              ]
            }
          ]
        } as any;
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey!}` },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const det = await safeText(res);
          console.error('[chat-openai] Responses multimodal erro:', res.status, det);
          return sendJSON(400, { error: `Responses multimodal falhou: ${res.status} ${det}` });
        }
        const js = await res.json();
        // Extrair texto do formato novo (similar ao callResponsesText)
        let output = '';
        if (typeof js?.output_text === 'string') {
          output = js.output_text.trim();
        }
        if (!output && Array.isArray(js?.output)) {
          for (const item of js.output) {
            if (item?.type === 'message' && Array.isArray(item?.content)) {
              for (const c of item.content) {
                if (c?.type === 'output_text' && typeof c?.text === 'string') {
                  output = c.text.trim();
                  if (output) break;
                }
              }
            }
            if (output) break;
          }
        }
        if (!output) {
          // fallback genérico
          output = 'Análise concluída, mas nenhum texto foi retornado pelo modelo.';
        }
        return sendJSON(200, { ok: true, output_text: output, sources: [] });
      } catch (err: any) {
        console.error('[chat-openai] Erro multimodal:', err);
        return sendJSON(500, { error: 'Erro ao processar imagens', details: err?.message || String(err) });
      }
    }

    // Se for usar Vector Store e houver id, usar Responses API com file_search
    if (use_vector_store && vector_store_id) {
      // Opcional: checar arquivos prontos antes de responder
      try {
        const listRes = await fetch(`https://api.openai.com/v1/vector_stores/${vector_store_id}/files`, {
          headers: { Authorization: `Bearer ${apiKey}`, 'OpenAI-Beta': 'assistants=v2' },
        });
        if (!listRes.ok) {
          const det = await safeText(listRes);
          return sendJSON(400, { error: `List VS files failed: ${listRes.status} ${det}` });
        }
        const js = await listRes.json();
        const ready = (js?.data || []).some((f: any) => ['ready', 'completed'].includes(String(f?.status || f?.state)));
        if (!ready) {
          return sendJSON(200, { ok: true, output_text: 'Os documentos ainda estão sendo processados. Por favor, aguarde alguns instantes e tente novamente.', sources: [] });
        }
      } catch (error: any) {
        return sendJSON(500, { error: 'Internal error', details: error.message });
      }

            let vsModel = mdl;
      if (vsModel.startsWith('gpt-4') && !vsModel.includes('turbo') && !vsModel.includes('o')) {
        vsModel = 'gpt-4o'; // Força um modelo compatível com file_search
      }

      // Assistants v2 (threads/runs) sem assistant_id: usa objeto 'assistant' inline
      console.log('[chat-openai] Chamando Assistants v2 (threads/runs) com assistant inline e file_search:', { vector_store_id, model: mdl, temperature: temp });
      const baseUrl = 'https://api.openai.com/v1';
      const commonHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2',
      };

      // 1) Criar thread
      const tRes = await fetch(`${baseUrl}/threads`, { method: 'POST', headers: commonHeaders, body: JSON.stringify({}) });
      if (!tRes.ok) { const det = await safeText(tRes); return sendJSON(tRes.status, { error: `Create thread failed: ${tRes.status} ${det}` }); }
      const tJson = await tRes.json();
      const thread_id = tJson?.id;
      if (!thread_id) return sendJSON(500, { error: 'Thread not created' });

      // 2) Adicionar mensagem do usuário (input_text)
      const mRes = await fetch(`${baseUrl}/threads/${thread_id}/messages`, {
        method: 'POST', headers: commonHeaders,
        body: JSON.stringify({ role: 'user', content: input_text })
      });
      if (!mRes.ok) { const det = await safeText(mRes); return sendJSON(mRes.status, { error: `Add message failed: ${mRes.status} ${det}` }); }

      // 3) Criar um assistant temporário, executar o run e tentar apagar o assistant ao final
      let tempAssistantId: string | null = null;
      try {
        const aRes = await fetch(`${baseUrl}/assistants`, {
          method: 'POST', headers: commonHeaders,
          body: JSON.stringify({
            model: vsModel,
            instructions: 'RESPONDA APENAS com base nos documentos do Vector Store. NÃO invente, NÃO generalize, NÃO use conhecimento externo. Se a pergunta não for respondida pelos documentos, diga claramente: "Não encontrei essa informação nos documentos." Quando houver uma URL no conteúdo, responda com ela de forma direta.',
            tools: [{ type: 'file_search' }],
          })
        });
        if (!aRes.ok) { const det = await safeText(aRes); return sendJSON(aRes.status, { error: `Create assistant failed: ${aRes.status} ${det}` }); }
        const aJson = await aRes.json();
        tempAssistantId = aJson?.id || null;
        if (!tempAssistantId) return sendJSON(500, { error: 'Assistant not created' });

        const rRes = await fetch(`${baseUrl}/threads/${thread_id}/runs`, {
          method: 'POST', headers: commonHeaders,
          body: JSON.stringify({
            assistant_id: tempAssistantId,
            temperature: temp,
            tool_resources: { file_search: { vector_store_ids: [vector_store_id] } },
          })
        });
        if (!rRes.ok) { const det = await safeText(rRes); return sendJSON(rRes.status, { error: `Create run failed: ${rRes.status} ${det}` }); }
        const rJson = await rRes.json();
        const run_id = rJson?.id;
        if (!run_id) return sendJSON(500, { error: 'Run not created' });

        // 4) Poll do run até concluir
        const deadline = Date.now() + 35_000; // 35s
        let status = 'queued';
        while (Date.now() < deadline) {
          const gRes = await fetch(`${baseUrl}/threads/${thread_id}/runs/${run_id}`, { headers: commonHeaders });
          if (!gRes.ok) { const det = await safeText(gRes); return sendJSON(gRes.status, { error: `Get run failed: ${gRes.status} ${det}` }); }
          const gJson = await gRes.json();
          status = gJson?.status || status;
          if (status === 'completed') break;
          if (['failed', 'cancelled', 'expired'].includes(status)) {
            return sendJSON(200, { ok: true, output_text: 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.', sources: [] });
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (status !== 'completed') {
          return sendJSON(200, { ok: true, output_text: 'A solicitação está demorando mais que o esperado. Por favor, tente novamente com uma pergunta mais direta.', sources: [] });
        }

        // 5) Buscar mensagens e extrair texto + citações
        const msgsRes = await fetch(`${baseUrl}/threads/${thread_id}/messages?order=desc&limit=10`, { headers: commonHeaders });
        if (!msgsRes.ok) { const det = await safeText(msgsRes); return sendJSON(msgsRes.status, { error: `List messages failed: ${msgsRes.status} ${det}` }); }
        const msgs = await msgsRes.json();
        let output_text = '';
        const citedFileIds = new Set<string>();
        for (const item of (msgs?.data || [])) {
          if (item?.role === 'assistant' && Array.isArray(item?.content)) {
            for (const c of item.content) {
              if (c?.type === 'text' && c?.text?.value) {
                output_text += (output_text ? '\n' : '') + c.text.value;
                if (Array.isArray(c?.text?.annotations)) {
                  for (const ann of c.text.annotations) {
                    if (ann?.file_citation?.file_id) citedFileIds.add(ann.file_citation.file_id);
                  }
                }
              }
            }
          }
        }
        // Mapeia fontes diretamente pela API da OpenAI (file_id -> filename)
        let sources: string[] = [];
        if (citedFileIds.size > 0) {
          try {
            const fileNames = await Promise.all(Array.from(citedFileIds).map(async (fid) => {
              try {
                const fres = await fetch(`${baseUrl}/files/${fid}`, { headers: { Authorization: `Bearer ${apiKey}` } });
                if (!fres.ok) return null;
                const fj = await fres.json();
                return fj?.filename || fj?.name || null;
              } catch { return null; }
            }));
            sources = fileNames.filter((n): n is string => !!n);
          } catch {}
        }

        if (!output_text) {
          const msg = 'Não encontrei informações relevantes nos documentos do Vector Store para responder a esta pergunta.';
          return sendJSON(200, { ok: true, output_text: msg, sources });
        }

        return sendJSON(200, { ok: true, output_text, sources });
      } finally {
        // Tentativa de limpeza do assistant temporário
        try {
          if (tempAssistantId) {
            await fetch(`${baseUrl}/assistants/${tempAssistantId}`, { method: 'DELETE', headers: commonHeaders });
          }
        } catch {}
      }

    }

    // Caminho simples: sem multimodal, sem vector_store, sem RAG - chamada direta à Responses API
    console.log('[chat-openai] Entrando no caminho simples (sem multimodal, sem vector_store, chamada direta)');
    try {
      console.log('[chat-openai] Iniciando chamada direta para Responses API');
      console.log('[chat-openai] Input text length:', input_text.length);
      console.log('[chat-openai] Primeiros 200 chars do input:', input_text.substring(0, 200));
      
      const gen = await callResponsesText(apiKey!, mdl, input_text, temp);
      if (!gen) {
        console.error('[chat-openai] Falha ao gerar resposta com chamada direta');
        return sendJSON(400, { error: 'Falha ao gerar resposta' });
      }
      console.log('[chat-openai] Resposta gerada com sucesso, tamanho:', gen.length);
      console.log('[chat-openai] Primeiros 200 chars da resposta:', gen.substring(0, 200));

      return sendJSON(200, { ok: true, output_text: gen, sources: [] });
    } catch (err: any) {
      console.error('[chat-openai] Erro no caminho simples:', err);
      return sendJSON(500, { error: 'Erro na chamada direta', details: err?.message || String(err) });
    }

    // Caminho alternativo: RAG Local (pgvector) usando rag_search_array
    console.log('[chat-openai] Entrando no caminho RAG Local (não é multimodal, não usa vector_store)');
    // 1) Gerar embedding da consulta (OpenAI embeddings)
    let query = '';
    const lastUserMsg = [...history].reverse().find((m) => m.role === 'user');
    query = lastUserMsg?.content || history.at(-1)?.content || '';
    console.log('[chat-openai] Query para RAG:', query.substring(0, 100));
    if (!query) {
      console.log('[chat-openai] Query vazia, retornando erro');
      return sendJSON(400, { error: 'Prompt vazio' });
    }

    try {
      console.log('[chat-openai] Iniciando RAG Local para agent_id:', agent_id, 'query:', query.substring(0, 100));
      
      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey!}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: [query] })
      });
      if (!embRes.ok) {
        const det = await safeText(embRes);
        console.error('[chat-openai] Erro na Embedding API:', embRes.status, det);
        return sendJSON(400, { error: `Embedding API falhou: ${embRes.status} ${det}` });
      }
      const embJson = await embRes.json();
      const qEmb = (embJson?.data?.[0]?.embedding || []) as number[];
      if (!Array.isArray(qEmb) || qEmb.length === 0) {
        console.error('[chat-openai] Embedding inválido:', qEmb);
        return sendJSON(400, { error: 'Embedding inválido para a consulta' });
      }
      console.log('[chat-openai] Embedding gerado com sucesso, tamanho:', qEmb.length);

      // 2) Buscar top-K chunks relacionados ao agente
      const K = 4; // Reduzido de 6 para melhorar performance
      console.log('[chat-openai] Chamando rag_search_array com agent_id:', agent_id, 'K:', K);
      const { data: hits, error: searchErr } = await sb.rpc('rag_search_array', { p_agent: agent_id, p_query: qEmb, p_k: K });
      if (searchErr) {
        console.error('[chat-openai] Erro no rag_search_array:', searchErr);
        return sendJSON(400, { error: 'Falha no RAG local (rag_search_array)', details: searchErr.message || String(searchErr) });
      }
      console.log('[chat-openai] rag_search_array retornou', hits?.length || 0, 'chunks');

      const chunks = (hits || []).map((row: any) => ({
        document_id: row.document_id as string,
        chunk_index: row.chunk_index as number,
        content: row.content as string,
        distance: row.distance as number,
      }));

      // 3) Montar contexto
      const context = buildContextFromChunks(chunks, 1500); // Reduzido de 2800 para 1500 chars
      console.log('[chat-openai] Contexto montado, tamanho:', context.length);

      // 4) Montar entrada para Responses API
      const augmented = `${context}\n\n${input_text}`;
      console.log('[chat-openai] Input para Responses API, tamanho:', augmented.length);

      const gen = await callResponsesText(apiKey, mdl, augmented, temp);
      if (!gen) {
        console.error('[chat-openai] Falha ao gerar resposta com contexto');
        return sendJSON(400, { error: 'Falha ao gerar resposta com contexto' });
      }
      console.log('[chat-openai] Resposta gerada com sucesso, tamanho:', gen.length);

      // Nomes de fontes (opcional)
      let sources: string[] = [];
      const docIds = Array.from(new Set(chunks.map(c => c.document_id)));
      if (docIds.length) {
        console.log('[chat-openai] Buscando nomes dos documentos para IDs:', docIds);
        const { data: files, error: filesError } = await sb
          .from('rag_documents')
          .select('id, filename')
          .in('id', docIds);
        if (filesError) {
          console.error('[chat-openai] Erro ao buscar nomes dos documentos:', filesError);
        } else {
          sources = (files || []).map((f: any) => f.filename).filter(Boolean);
          console.log('[chat-openai] Fontes encontradas:', sources);
        }
      }

      return sendJSON(200, { ok: true, output_text: gen, sources });
    } catch (err: any) {
      console.error('[chat-openai] Erro no caminho RAG local:', err);
      return sendJSON(500, { error: 'Erro no caminho RAG local', details: err?.message || String(err) });
    }

  } catch (e: any) {
    console.error('[chat-openai] Erro geral:', e);
    return sendJSON(500, { error: e?.message || 'Internal error', stack: e?.stack });
  }
});

async function safeText(res: Response): Promise<string> {
  try { const j = await res.json(); return j?.error?.message || JSON.stringify(j); } catch {}
  try { return await res.text(); } catch {}
  return '';
}

// Constrói contexto textual a partir dos chunks, respeitando limite de caracteres
function buildContextFromChunks(chunks: { content: string; distance: number }[], maxChars = 2800): string {
  let acc = 'Contexto recuperado (RAG Local):\n';
  let size = acc.length;
  for (const c of chunks) {
    const block = `\n---\n${(c.content || '').trim()}\n`;
    if (size + block.length > maxChars) break;
    acc += block;
    size += block.length;
  }
  return acc + '\nUse apenas as partes relevantes para responder.';
}

// Chama OpenAI Responses API para obter texto simples (output_text)
async function callResponsesText(apiKey: string, model: string, input: string, temperature = 0.7): Promise<string> {
  console.log('[chat-openai] Iniciando callResponsesText com model:', model, 'input length:', input.length);
  
  // Formato correto da Responses API - input deve ser um array para o formato novo
  const requestBody = {
    model,
    input: [{ role: 'user', content: input }],
    temperature
  };
  
  console.log('[chat-openai] Request body:', JSON.stringify(requestBody, null, 2));
  
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody)
  });
  
  console.log('[chat-openai] Responses API status:', res.status, res.statusText);
  
  if (!res.ok) {
    let detail = '';
    try { 
      const j = await res.json(); 
      detail = j?.error?.message || ''; 
      console.error('[chat-openai] Responses API error:', j);
    } catch {
      try { 
        detail = await res.text(); 
        console.error('[chat-openai] Responses API error text:', detail);
      } catch {}
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
  }
  
  const js = await res.json();
  console.log('[chat-openai] Responses API response:', JSON.stringify(js, null, 2));
  
  // Verificar diferentes formatos de resposta da Responses API
  
  // 1. Tentar output_text direto (formato antigo)
  let output = (js?.output_text ?? '').trim();
  if (output) {
    console.log('[chat-openai] output_text encontrado, length:', output.length);
    return output;
  }
  
  // 2. Tentar extrair do array output (formato novo)
  if (Array.isArray(js?.output)) {
    for (const item of js.output) {
      // Verificar se é uma mensagem de assistant
      if (item?.type === 'message' && Array.isArray(item?.content)) {
        for (const content of item.content) {
          if (content?.type === 'output_text' && typeof content?.text === 'string') {
            const txt = content.text.trim();
            if (txt) {
              console.log('[chat-openai] output_text encontrado em output[].content, length:', txt.length);
              return txt;
            }
          }
        }
      }
      
      // Verificar se é output_text direto no array
      if (item?.type === 'output_text' && typeof item?.text === 'string') {
        const txt = item.text.trim();
        if (txt) {
          console.log('[chat-openai] output_text encontrado em output[], length:', txt.length);
          return txt;
        }
      }
    }
  }
  
  // 3. Tentar extrair de response_output (outro formato possível)
  if (Array.isArray(js?.response_output)) {
    for (const item of js.response_output) {
      if (item?.type === 'message' && Array.isArray(item?.content)) {
        for (const content of item.content) {
          if (content?.type === 'output_text' && typeof content?.text === 'string') {
            const txt = content.text.trim();
            if (txt) {
              console.log('[chat-openai] output_text encontrado em response_output, length:', txt.length);
              return txt;
            }
          }
        }
      }
    }
  }
  
  // 4. Fallback: procurar qualquer campo text na resposta
  const findTextInObject = (obj: any): string => {
    if (typeof obj === 'string' && obj.trim()) {
      return obj.trim();
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = findTextInObject(item);
        if (result) return result;
      }
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        const result = findTextInObject(value);
        if (result) return result;
      }
    }
    return '';
  };
  
  const fallbackText = findTextInObject(js);
  if (fallbackText) {
    console.log('[chat-openai] texto encontrado via fallback, length:', fallbackText.length);
    return fallbackText;
  }
  
  console.error('[chat-openai] Nenhum texto encontrado na resposta da Responses API');
  return '';
}
