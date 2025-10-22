// deno-lint-ignore-file no-explicit-any
// Edge Function: run-external-action
// Proxy seguro para executar ações externas (ex.: n8n) configuradas em external_actions

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Shim mínimo para o lint local reconhecer Deno.env
// (no runtime das Functions, Deno já existe)
declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type RunActionRequest = {
  organization_id?: string | null;
  agent_id?: string | null;
  conversation_id?: string | null;
  action_name?: string | null;
  action_id?: string | null;
  params?: Record<string, any> | null;
  debug_ok_errors?: boolean;
};

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      const reqHeaders = req.headers.get("Access-Control-Request-Headers") || "authorization, x-client-info, apikey, content-type";
      const headers = { ...corsHeaders, "Access-Control-Allow-Headers": reqHeaders } as Record<string, string>;
      return new Response("ok", { status: 200, headers });
    }

    let debug_ok_errors = false;
    const sendJSON = (status: number, body: Record<string, any>) => {
      const effectiveStatus = debug_ok_errors && status !== 200 ? 200 : status;
      const b = debug_ok_errors && status !== 200 ? { ok: false, status, ...body } : body;
      return new Response(JSON.stringify(b), { status: effectiveStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    };

    if (req.method !== "POST") return sendJSON(405, { error: "Method not allowed" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return sendJSON(500, { error: "Missing Supabase env" });

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let payload: RunActionRequest;
    try {
      payload = (await req.json().catch(() => ({}))) as RunActionRequest;
    } catch (e: any) {
      return sendJSON(400, { error: "Invalid JSON", details: e?.message || String(e) });
    }

    debug_ok_errors = payload?.debug_ok_errors === true;

    const actionName = (payload?.action_name || "").trim();
    const actionId = (payload?.action_id || "").trim();
    const orgId = (payload?.organization_id || null);
    const agentId = (payload?.agent_id || null);
    const conversationId = (payload?.conversation_id || null);
    const params = (payload?.params || {}) as Record<string, any>;

    if (!actionName && !actionId) return sendJSON(400, { error: "action_name or action_id is required" });

    // Carrega ação
    let action: any = null;
    try {
      let q = sb.from("external_actions").select("*").limit(1);
      if (actionId) q = q.eq("id", actionId);
      else q = q.eq("name", actionName).eq("organization_id", orgId);
      const { data, error } = await q.single();
      if (error) throw error;
      action = data;
    } catch (e: any) {
      return sendJSON(404, { error: "Action not found", details: e?.message || String(e) });
    }

    if (!action?.enabled) return sendJSON(400, { error: "Action disabled" });

    // Monta request ao endpoint externo
    const method = String(action.method || "POST").toUpperCase();
    const url = String(action.url || "");
    if (!url) return sendJSON(400, { error: "Invalid action url" });

    // Headers base do registro
    const headers: Record<string, string> = {};
    try {
      const h = action.headers && typeof action.headers === "object" ? action.headers : {};
      for (const [k, v] of Object.entries(h)) {
        if (typeof v === "string") headers[k] = v;
      }
    } catch {}

    // Auth do registro (se houver)
    try {
      const auth = action.auth && typeof action.auth === "object" ? action.auth : {};
      const type = String(auth.type || "none");
      if (type === "bearer") {
        const envKey = String(auth.secret_env || "");
        const token = envKey ? (Deno.env.get(envKey) || "") : "";
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } else if (type === "header") {
        const envKey = String(auth.secret_env || "");
        const headerName = String(auth.header_name || "X-API-Key");
        const val = envKey ? (Deno.env.get(envKey) || "") : "";
        if (val) headers[headerName] = val;
      }
    } catch {}

    // Corpo
    const bodyJson = {
      ...params,
      // Infos de contexto úteis ao n8n
      _context: {
        organization_id: orgId,
        agent_id: agentId,
        conversation_id: conversationId,
        action_id: action.id,
        action_name: action.name,
        ts: new Date().toISOString(),
      },
    };

    const started = Date.now();
    let status = 0; let errorMsg = "";
    try {
      const resp = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: method === "GET" ? undefined : JSON.stringify(bodyJson),
      });
      status = resp.status;
      const contentType = resp.headers.get("content-type") || "";
      if (!resp.ok) {
        const detail = contentType.includes("application/json") ? await resp.json().catch(() => ({})) : await resp.text();
        return sendJSON(status, { error: "External action failed", details: detail });
      }
      const data = contentType.includes("application/json") ? await resp.json().catch(() => ({})) : await resp.text();
      return sendJSON(200, { ok: true, data });
    } catch (e: any) {
      status = status || 500;
      errorMsg = e?.message || String(e);
      return sendJSON(500, { error: "Proxy error", details: errorMsg });
    } finally {
      const duration_ms = Date.now() - started;
      // Melhor esforço: logar execução (service role)
      try {
        await sb.from("external_action_logs").insert({
          organization_id: orgId,
          action_id: action?.id || null,
          agent_id: agentId,
          conversation_id: conversationId,
          status,
          duration_ms,
          error: errorMsg || null,
        });
      } catch {}
    }
  } catch (e: any) {
    console.error("[run-external-action] erro geral:", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
