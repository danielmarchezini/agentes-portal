// deno-lint-ignore-file no-explicit-any
// Edge Function: chat-anthropic
// Centraliza chamadas de chat com Anthropic no servidor (usa chave por organização via RPC)

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
  debug_ok_errors?: boolean;
};

        serve(async (req) => {
          // Flag de depuração controlado pelo payload (inicialmente falso)
          let debug_ok_errors = false;
  
  // Helper central para respostas JSON com CORS e, se debug ativo, forçar status 200 e embutir status original
  const sendJSON = (status: number, body: Record<string, any>) => {
    const effectiveStatus = debug_ok_errors && status !== 200 ? 200 : status;
    const b = debug_ok_errors && status !== 200 ? { ok: false, status, ...body } : body;
    return new Response(JSON.stringify(b), { status: effectiveStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  };

  try {
    // CORS preflight handler (ecoar os headers solicitados pelo navegador)
    if (req.method === 'OPTIONS') {
      const reqHeaders = req.headers.get('Access-Control-Request-Headers') || 'authorization, x-client-info, apikey, content-type';
      const headers = { ...corsHeaders, 'Access-Control-Allow-Headers': reqHeaders } as Record<string, string>;
      return new Response('ok', { status: 200, headers });
    }

    // Parse do corpo da requisição
    const body: ChatRequest = await req.json();
    debug_ok_errors = !!body.debug_ok_errors;

            // Validação inicial: organization_id é obrigatório para obter chave por organização
    if (!body.organization_id) {
      return sendJSON(400, { error: 'organization_id ausente', details: 'Informe organization_id no body para recuperar a API key da Anthropic.' });
    }

    // Obter a chave da API da Anthropic para a organização
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return sendJSON(500, { error: 'Variáveis de ambiente ausentes', details: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis da Edge Function.' });
    }

    const rpcHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey as string,
    } as Record<string, string>;
    // 1) Preferir RPC administrativa (service_role) para evitar RLS/is_member
    let apiKey: string | null = null;
    try {
      const adminRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_llm_secret_admin`, {
        method: 'POST',
        headers: rpcHeaders,
        body: JSON.stringify({ p_org: body.organization_id, p_provider: 'anthropic' })
      });
      if (adminRes.ok) {
        apiKey = await adminRes.json();
      }
    } catch {}

    // 2) Fallback: RPC de usuário (mantida por compatibilidade)
    if (!apiKey) {
      const apiKeyResult = await fetch(`${supabaseUrl}/rest/v1/rpc/get_llm_api_key`, {
        method: 'POST',
        headers: rpcHeaders,
        body: JSON.stringify({
          p_org_id: body.organization_id,
          p_provider: 'anthropic'
        })
      });
      if (apiKeyResult.ok) {
        apiKey = await apiKeyResult.json();
      } else {
        const details = await apiKeyResult.text().catch(() => '');
        return sendJSON(500, { error: 'Failed to fetch API key', details, status: apiKeyResult.status });
      }
    }

    if (!apiKey) {
      return sendJSON(400, { error: 'Anthropic API Key não configurada para esta organização', details: { organization_id: body.organization_id } });
    }
    // Preparar as mensagens para o formato da Anthropic
    // Enviar somente histórico real de user/assistant, preservando ordem, e ignorar entradas 'system'
    const msgs = body.history
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({ role: msg.role, content: msg.content }));

    // Fazer a chamada para a API da Anthropic
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'User-Agent': 'portal-agentes/1.0'
      },
      body: JSON.stringify({
        model: body.model || 'claude-3-sonnet-20240229',
        max_tokens: 4096,
        temperature: body.temperature || 0.7,
        system: body.system,
        messages: msgs
      })
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      let parsed: any = null;
      try { parsed = JSON.parse(errorText); } catch {}
      const notFoundModel = parsed?.error?.type === 'not_found_error' && /model/i.test(parsed?.error?.message || '');

      // Fallback automático para modelos suportados quando o solicitado não existir/estiver indisponível
      if (notFoundModel) {
        const requested = body.model || '';
        const candidates = ['claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307'].filter(m => m !== requested);
        for (const alt of candidates) {
          try {
            const retry = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'User-Agent': 'portal-agentes/1.0'
              },
              body: JSON.stringify({
                model: alt,
                max_tokens: 4096,
                temperature: body.temperature || 0.7,
                system: body.system,
                messages: msgs
              })
            });
            if (retry.ok) {
              const retryData = await retry.json();
              return sendJSON(200, {
                output_text: retryData.content?.[0]?.text || '',
                usage: retryData.usage,
                model: retryData.model,
                id: retryData.id,
                fallback_used: alt
              });
            }
          } catch (_) { /* tenta próximo */ }
        }
      }

      console.error('Anthropic API Error:', {
        status: anthropicResponse.status,
        error: errorText
      });
      return sendJSON(anthropicResponse.status, { 
        error: 'Anthropic API Error', 
        details: errorText,
        status: anthropicResponse.status 
      });
    }

    const anthropicData = await anthropicResponse.json();
    
    // Retornar a resposta no formato esperado pelo frontend
    return sendJSON(200, {
      output_text: anthropicData.content[0].text,
      usage: anthropicData.usage,
      model: anthropicData.model,
      id: anthropicData.id
    });

  } catch (error) {
    console.error('Error in chat-anthropic:', error);
    return sendJSON(500, { 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
});
