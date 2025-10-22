// Deno Deploy Edge Function: test-llm
// Tests LLM provider connectivity server-side using org-scoped secrets via RPC
// POST body: { provider: 'openai'|'anthropic'|'google'|'perplexity'|'ollama', organization_id?: string, model?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { provider, organization_id, model, candidates, list } = await req.json();
    if (!provider) {
      return new Response(JSON.stringify({ ok: false, error: 'provider is required' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'Supabase env missing' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const orgId = organization_id || null;
    if (!orgId) {
      return new Response(JSON.stringify({ ok: false, error: 'organization_id is required' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ok = async (data?: any) => new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const fail = async (msg: string, extra?: any) => new Response(JSON.stringify({ ok: false, error: msg, details: extra }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (provider === 'openai') {
      // Preferir API canônica multi-tenant e fazer fallback para admin
      let { data: key } = await sb.rpc('get_llm_api_key', { p_org_id: orgId, p_provider: 'openai' });
      if (!key) { const r = await sb.rpc('get_llm_secret_admin', { p_org: orgId, p_provider: 'openai' }); key = r.data as any; }
      if (!key) return fail('OpenAI API Key not found');
      const m = model || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: m, messages: [{ role: 'user', content: 'ping' }] })
      });
      if (!res.ok) return fail(await res.text());
      return ok();
    }

    if (provider === 'anthropic') {
      let { data: key } = await sb.rpc('get_llm_api_key', { p_org_id: orgId, p_provider: 'anthropic' });
      if (!key) { const r = await sb.rpc('get_llm_secret_admin', { p_org: orgId, p_provider: 'anthropic' }); key = r.data as any; }
      if (!key) return fail('Anthropic API Key not found');
      const internalList = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ];
      const toTry: string[] = Array.isArray(candidates) && candidates.length
        ? candidates.map(String)
        : (model ? [String(model)] : internalList);
      const successes: Array<{ model: string; status: number }> = [];
      const failures: Array<{ model: string; status: number; error: string }> = [];
      for (const m of toTry) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': String(key), 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: m, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] })
        });
        const txt = await res.text();
        if (res.ok) successes.push({ model: m, status: res.status });
        else failures.push({ model: m, status: res.status, error: txt });
        if (!list && successes.length > 0) return ok({ model: successes[0].model });
      }
      if (list) return ok({ successes, failures });
      return fail('No working models for this key', { successes, failures });
    }

    if (provider === 'google') {
      let { data: key } = await sb.rpc('get_llm_api_key', { p_org_id: orgId, p_provider: 'google' });
      if (!key) { const r = await sb.rpc('get_llm_secret_admin', { p_org: orgId, p_provider: 'google' }); key = r.data as any; }
      if (!key) return fail('Google AI API Key not found');

      // Modelos candidatos atualizados (prioriza 2.5, mantém 1.5 como fallback de compatibilidade)
      const internalList = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
      ];
      const toTry: string[] = Array.isArray(candidates) && candidates.length
        ? candidates.map(String)
        : (model ? [String(model)] : internalList);

      const successes: Array<{ model: string; status: number }> = [];
      const failures: Array<{ model: string; status: number; error: string }> = [];
      for (const m of toTry) {
        const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(String(key))}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] })
        });
        const txt = await res.text();
        if (res.ok) {
          successes.push({ model: m, status: res.status });
        } else {
          failures.push({ model: m, status: res.status, error: txt });
        }
        // Em modo simples, retorne na primeira que funcionar
        if (!list && successes.length > 0) return ok({ model: successes[0].model });
      }
      if (list) return ok({ successes, failures });
      return fail('No working Google models for this key', { successes, failures });
    }

    if (provider === 'perplexity') {
      let { data: key } = await sb.rpc('get_llm_api_key', { p_org_id: orgId, p_provider: 'perplexity' });
      if (!key) { const r = await sb.rpc('get_llm_secret_admin', { p_org: orgId, p_provider: 'perplexity' }); key = r.data as any; }
      if (!key) return fail('Perplexity API Key not found');
      // Lista candidata: pode vir do body (candidates), de um 'list' (descoberta), de 'model' único ou fallback interno
      const internalList = [
        'sonar',
        'sonar-pro',
        'sonar-reasoning',
        'sonar-reasoning-pro',
        'sonar-deep-research'
      ];
      const toTry: string[] = Array.isArray(candidates) && candidates.length
        ? candidates.map(String)
        : (model ? [String(model)] : internalList);
      const successes: Array<{ model: string; status: number }> = [];
      const failures: Array<{ model: string; status: number; error: string }> = [];
      for (const m of toTry) {
        const res = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: m, messages: [{ role: 'user', content: 'ping' }], temperature: 0 })
        });
        const txt = await res.text();
        if (res.ok) successes.push({ model: m, status: res.status });
        else failures.push({ model: m, status: res.status, error: txt });
        // Se não for modo listagem/descoberta, retorne na primeira que funcionar
        if (!list && successes.length > 0) return ok({ model: successes[0].model });
      }
      // Em modo listagem (list=true) ou se nenhuma funcionou, retorne breakdown completo
      if (list) return ok({ successes, failures });
      return fail('No working models for this key', { successes, failures });
    }

    if (provider === 'ollama') {
      let { data: endpoint } = await sb.rpc('get_llm_api_key', { p_org_id: orgId, p_provider: 'ollama' });
      if (!endpoint) { const r = await sb.rpc('get_llm_secret_admin', { p_org: orgId, p_provider: 'ollama' }); endpoint = r.data as any; }
      if (!endpoint) return fail('Ollama endpoint not found');
      const base = String(endpoint).replace(/\/$/, '');
      const res = await fetch(`${base}/api/tags`);
      if (!res.ok) return fail(await res.text());
      return ok();
    }

    return fail('Unsupported provider');
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
