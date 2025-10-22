// deno-lint-ignore-file no-explicit-any
// Edge Function: vs-upload
// Uploads files to OpenAI and attaches them to a Vector Store, server-side (avoids CORS and key exposure)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Lazy import supabase client to speed cold start
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const ctype = req.headers.get('content-type') || '';
    if (!ctype.toLowerCase().includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be multipart/form-data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const form = await req.formData();
    const orgIdParam = String(form.get('organization_id') || '');
    const agentId = String(form.get('agent_id') || '');
    let vectorStoreId = String(form.get('vector_store_id') || '');
    const files = form.getAll('files').filter((f): f is File => f instanceof File);

    if (!agentId) {
      return new Response(JSON.stringify({ error: 'agent_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!files.length) {
      return new Response(JSON.stringify({ error: 'No files provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch OpenAI key via RPC
    // Descobrir organização pelo agente (fonte de verdade)
    let orgId: string | null = null;
    try {
      const { data: agentRow } = await sb.from('agents').select('organization_id').eq('id', agentId).single();
      orgId = (agentRow as any)?.organization_id || null;
    } catch { orgId = null; }
    if (!orgId) orgId = orgIdParam || null;

    let apiKey: string | null = null;
    let rpcErr: any = null;
    if (orgId) {
      const { data, error } = await sb.rpc('get_llm_secret', { p_org: orgId, p_provider: 'openai' });
      apiKey = (data as string) || null;
      rpcErr = error || null;
    }
    // Fallback: variável de ambiente OPENAI_API_KEY
    if (!apiKey) {
      const envKey = Deno.env.get('OPENAI_API_KEY') || '';
      if (envKey) apiKey = envKey;
    }
    if (!apiKey) {
      const why = rpcErr ? `rpc error: ${rpcErr.message || rpcErr}` : `no key via RPC; orgId used: ${orgId ?? 'null'}`;
      return new Response(JSON.stringify({ error: `OpenAI API Key not configured (${why})` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Ensure Vector Store
    if (!vectorStoreId) {
      const resVS = await fetch('https://api.openai.com/v1/vector_stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'OpenAI-Beta': 'assistants=v2' },
        body: JSON.stringify({ name: `agent:${agentId}` })
      });
      if (!resVS.ok) {
        const det = await safeText(resVS);
        return new Response(JSON.stringify({ error: `Failed to create vector store: ${resVS.status} ${resVS.statusText} ${det}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const vsJson = await resVS.json();
      vectorStoreId = vsJson.id as string;
      // persist on agents table best-effort
      try { await sb.from('agents').update({ vector_store_id: vectorStoreId } as any).eq('id', agentId); } catch {}
    }

    const uploaded: Array<{ name: string; file_id: string }> = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (const file of files) {
      try {
        const fForm = new FormData();
        fForm.append('file', file);
        fForm.append('purpose', 'assistants');
        const resFile = await fetch('https://api.openai.com/v1/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: fForm,
        });
        if (!resFile.ok) {
          const det = await safeText(resFile);
          failed.push({ name: file.name, error: `upload ${resFile.status} ${resFile.statusText} ${det}` });
          continue;
        }
        const fJson = await resFile.json();
        const fileId = fJson.id as string;
        const resAttach = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'OpenAI-Beta': 'assistants=v2' },
          body: JSON.stringify({ file_id: fileId })
        });
        if (!resAttach.ok) {
          const det = await safeText(resAttach);
          failed.push({ name: file.name, error: `attach ${resAttach.status} ${resAttach.statusText} ${det}` });
          continue;
        }
        uploaded.push({ name: file.name, file_id: fileId });
      } catch (e: any) {
        failed.push({ name: (file as any)?.name || 'unknown', error: e?.message || 'unknown error' });
      }
    }

    return new Response(JSON.stringify({ ok: true, vector_store_id: vectorStoreId, uploaded, failed }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function safeText(res: Response): Promise<string> {
  try { const j = await res.json(); return j?.error?.message || JSON.stringify(j); } catch {}
  try { return await res.text(); } catch {}
  return '';
}
