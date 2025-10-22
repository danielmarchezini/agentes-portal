// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: ingest-doc
// - Baixa arquivo do Storage (bucket 'documents')
// - Extrai texto (suporte v1: .txt)
// - Chunking + embeddings (text-embedding-3-small)
// - Insere em rag_documents e rag_chunks

// Simple chunking
function chunkText(text: string, chunkSize = 800, overlap = 120): string[] {
  const clean = text.replace(/\r\n?/g, '\n');
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const slice = clean.slice(i, i + chunkSize);
    out.push(slice);
    i += chunkSize - overlap;
  }
  return out.filter(Boolean);
}

async function embedBatch(apiKey: string, texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts })
  });
  if (!res.ok) {
    const d = await res.text();
    throw new Error(`Embedding API falhou: ${res.status} ${d}`);
  }
  const js = await res.json();
  return (js.data || []).map((row: any) => row.embedding as number[]);
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  } as const;

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
  // Flag de debug disponível no escopo do handler (para uso no catch)
  let debug_ok_errors = false;
  try {
    const url = new URL(req.url);
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Suporta flag de debug para retornar 200 com detalhes de erro
    const payload = await req.json().catch(() => ({} as any));
    debug_ok_errors = payload?.debug_ok_errors === true;
    const agent_id = payload?.agent_id;
    const organization_id = payload?.organization_id;
    const storage_path = payload?.storage_path;
    if (!agent_id || !storage_path) {
      const st = debug_ok_errors ? 200 : 400;
      return new Response(JSON.stringify({ ok: false, status: 400, error: 'agent_id e storage_path são obrigatórios' }), { status: st, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const OPENAI_API_KEY_FALLBACK = Deno.env.get('OPENAI_API_KEY') || '';
    const OLLAMA_ENDPOINT_FALLBACK = Deno.env.get('OLLAMA_ENDPOINT') || '';
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      const st = debug_ok_errors ? 200 : 500;
      return new Response(JSON.stringify({ ok: false, status: 500, error: 'Variáveis do Supabase ausentes' }), { status: st, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Import dinâmico do supabase-js somente quando necessário (evita falha no preflight OPTIONS)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Obtém URL assinada para o arquivo
    const { data: signed, error: signErr } = await sb.storage
      .from('documents')
      .createSignedUrl(storage_path, 60);
    if (signErr || !signed?.signedUrl) {
      const st = debug_ok_errors ? 200 : 400;
      return new Response(JSON.stringify({ ok: false, status: 400, error: 'Falha ao gerar URL assinada' }), { status: st, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const filename = storage_path.split('/').pop() || storage_path;
    const ext = filename.toLowerCase().split('.').pop();

    // Baixa conteúdo
    const fileRes = await fetch(signed.signedUrl);
    if (!fileRes.ok) {
      const st = debug_ok_errors ? 200 : 400;
      return new Response(JSON.stringify({ ok: false, status: 400, error: 'Falha ao baixar arquivo do Storage' }), { status: st, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const buf = new Uint8Array(await fileRes.arrayBuffer());

    // Extração de texto por tipo
    let text = '';
    if (ext === 'txt') {
      text = new TextDecoder().decode(buf);
    } else if (ext === 'pdf' || ext === 'docx' || ext === 'doc') {
      // Para evitar quedas por incompatibilidades de import no Edge, não processamos esses formatos aqui.
      const st = debug_ok_errors ? 200 : 415;
      return new Response(
        JSON.stringify({ ok: false, status: 415, error: `Formato .${ext} não suportado nesta Edge Function. Use .txt/.md/.json ou o modo OpenAI Vector Store.` }),
        { status: st, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const st = debug_ok_errors ? 200 : 415;
      return new Response(JSON.stringify({ ok: false, status: 415, error: `Tipo de arquivo não suportado: .${ext}` }), { status: st, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Obtém a API key específica da organização (multi-tenant), com fallback
    let orgOpenAIKey = '';
    try {
      const { data: kdata, error: kerr } = await sb.rpc('get_llm_secret', { p_org: organization_id, p_provider: 'openai' });
      if (kerr) throw kerr;
      orgOpenAIKey = (kdata as string) || '';
    } catch (_) {
      // ignore, usaremos fallback
    }
    const effectiveKey = orgOpenAIKey || OPENAI_API_KEY_FALLBACK;
    if (!effectiveKey) {
      return new Response(JSON.stringify({ error: 'Chave OpenAI não configurada para esta organização (e sem fallback OPENAI_API_KEY)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const chunks = chunkText(text);

    // Descobre provider/model de embeddings do agente
    let embeddingProvider: 'openai' | 'ollama' = 'openai';
    let embeddingModel = 'text-embedding-3-small';
    try {
      const { data: agentRow } = await sb.from('agents').select('embedding_provider, embedding_model').eq('id', agent_id).single();
      if (agentRow?.embedding_provider && (agentRow.embedding_provider === 'ollama' || agentRow.embedding_provider === 'openai')) {
        embeddingProvider = agentRow.embedding_provider as 'openai' | 'ollama';
      }
      if (agentRow?.embedding_model) embeddingModel = agentRow.embedding_model as string;
    } catch (_) {}

    let embs: number[][] = [];
    if (embeddingProvider === 'ollama') {
      // Usa endpoint do Ollama da organização ou fallback de env
      let ollamaEndpoint = '';
      try {
        const { data: oe } = await sb.rpc('get_llm_secret', { p_org: organization_id, p_provider: 'ollama' });
        ollamaEndpoint = (oe as string) || '';
      } catch (_) {}
      if (!ollamaEndpoint) ollamaEndpoint = OLLAMA_ENDPOINT_FALLBACK;
      if (!ollamaEndpoint) return new Response(JSON.stringify({ error: 'Ollama endpoint não configurado' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const base = ollamaEndpoint.replace(/\/$/, '');
      for (const c of chunks) {
        const res = await fetch(`${base}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: embeddingModel || 'nomic-embed-text', input: c })
        });
        if (!res.ok) {
          const d = await res.text();
          return new Response(JSON.stringify({ error: `Falha no Ollama embeddings: ${res.status} ${d}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const js = await res.json();
        const emb = js?.embedding || js?.data?.[0]?.embedding;
        if (!emb) return new Response(JSON.stringify({ error: 'Resposta inválida do Ollama embeddings' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        embs.push(emb as number[]);
      }
    } else {
      // OpenAI (padrão)
      embs = await embedBatch(effectiveKey, chunks);
    }

    // cria documento
    const { data: docIns, error: docErr } = await sb
      .from('rag_documents')
      .insert({ organization_id, agent_id, filename, mime_type: `text/${ext}`, file_size: buf.byteLength, storage_path })
      .select('id')
      .single();
    if (docErr) throw docErr;
    const documentId = docIns.id as string;

    // insere chunks via RPC
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const e = embs[i];
      const { error } = await sb.rpc('rag_insert_chunk', {
        p_document_id: documentId,
        p_agent_id: agent_id,
        p_chunk_index: i,
        p_content: c,
        p_embedding: e,
      });
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true, document_id: documentId, chunks: chunks.length }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    // Quando o modo debug estiver ativo, devolve 200 com detalhes do erro
    try {
      // tenta recuperar o corpo para ver se veio com debug_ok_errors se o erro ocorreu antes do parse
      // Nota: se já tiver sido lido, isso pode falhar silenciosamente
    } catch {}
    const body = { ok: false, status: 500, error: String((e as any)?.message || e), stack: (e as any)?.stack };
    const status = 500;
    return new Response(JSON.stringify(body), { status: debug_ok_errors ? 200 : status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
