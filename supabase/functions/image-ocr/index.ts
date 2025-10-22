// deno-lint-ignore-file no-explicit-any
// Edge Function: image-ocr
// Recebe uma lista de imagens (URLs assinadas) e extrai texto via OpenAI (gpt-4o-mini)
// Futuro: indexar no RAG Local (rag_documents/rag_chunks) — por ora, apenas retorna o texto extraído.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

declare const Deno: {
  env: { get(key: string): string | undefined }
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface ImageItem {
  url: string; // URL assinada
  name?: string;
  path?: string;
}

interface OCRRequest {
  organization_id?: string | null;
  agent_id?: string | null;
  images: ImageItem[];
}

serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    const reqHeaders = req.headers.get('Access-Control-Request-Headers') || 'authorization, x-client-info, apikey, content-type';
    const headers = { ...corsHeaders, 'Access-Control-Allow-Headers': reqHeaders } as Record<string, string>;
    return new Response('ok', { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: 'Missing Supabase env' });
    }

    const body = (await req.json().catch(() => ({}))) as OCRRequest;
    const orgId = body.organization_id || null;
    const images = Array.isArray(body?.images) ? body.images.filter(i => i && typeof i.url === 'string' && i.url.trim()) : [];
    if (images.length === 0) return json(400, { error: 'images[] é obrigatório' });

    // Resolve OpenAI API Key por organização (fallback OPENAI_API_KEY da Edge)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let apiKey: string | null = null; let rpcErr: any = null;
    if (orgId) {
      try {
        const { data, error } = await sb.rpc('get_llm_secret', { p_org: orgId, p_provider: 'openai' });
        apiKey = (data as string) || null; rpcErr = error || null;
      } catch (e) { rpcErr = e; }
    }
    if (!apiKey) {
      const envKey = Deno.env.get('OPENAI_API_KEY') || '';
      if (envKey) apiKey = envKey;
    }
    if (!apiKey) {
      const why = rpcErr ? `rpc error: ${rpcErr?.message || rpcErr}` : 'no key via RPC and OPENAI_API_KEY not set';
      return json(400, { error: `OpenAI API Key not configured (${why})` });
    }

    const model = 'gpt-4o-mini';
    const results: Array<{ name: string; path?: string; text: string }> = [];

    for (const img of images) {
      try {
        const input = [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Extraia todo o texto legível desta imagem. Retorne apenas o texto contínuo, sem comentários.' },
              { type: 'input_image', image_url: { url: img.url } }
            ]
          }
        ];
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, input, temperature: 0 })
        });
        if (!res.ok) {
          const detail = await safeText(res);
          console.error('[image-ocr] Responses error:', res.status, detail);
          results.push({ name: img.name || 'imagem', path: img.path, text: '' });
          continue;
        }
        const js = await res.json();
        let text = '';
        if (typeof js?.output_text === 'string') text = js.output_text.trim();
        if (!text && Array.isArray(js?.output)) {
          for (const item of js.output) {
            if (item?.type === 'message' && Array.isArray(item?.content)) {
              for (const c of item.content) {
                if (c?.type === 'output_text' && typeof c?.text === 'string') { text = c.text.trim(); if (text) break; }
              }
            }
            if (text) break;
          }
        }
        results.push({ name: img.name || 'imagem', path: img.path, text: text || '' });
      } catch (e) {
        console.error('[image-ocr] erro geral OCR de uma imagem:', e);
        results.push({ name: img.name || 'imagem', path: img.path, text: '' });
      }
    }

    // Futuro: indexação no RAG Local (sb.from('rag_documents') / rag_chunks)
    return json(200, { ok: true, results });
  } catch (e: any) {
    console.error('[image-ocr] erro geral:', e);
    return json(500, { error: e?.message || 'internal error' });
  }
});

async function safeText(res: Response): Promise<string> {
  try { const j = await res.json(); return j?.error?.message || JSON.stringify(j); } catch {}
  try { return await res.text(); } catch {}
  return '';
}

function json(status: number, body: Record<string, any>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
