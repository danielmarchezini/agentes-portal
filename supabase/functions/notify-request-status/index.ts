// Edge Function: notify-request-status
// Recebe { request_id, status } e cria uma notificação para o solicitante
// E-mail/Webhook podem ser adicionados depois

// Declaração mínima para evitar erro de lint no IDE
declare const Deno: { env: { get: (k: string) => string | undefined } };

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const payload = await req.json().catch(() => ({}));
    const { request_id, status } = payload || {};
    if (!request_id || !status) {
      return new Response(JSON.stringify({ error: 'request_id e status são obrigatórios' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Busca a solicitação para obter requester_id e organization_id
    const { data: reqRow, error: reqErr } = await supabase
      .from('agent_requests')
      .select('id, requester_id, requester_name, organization_id, area')
      .eq('id', request_id)
      .single();
    if (reqErr || !reqRow) {
      throw new Error(reqErr?.message || 'Solicitação não encontrada');
    }

    const title = status === 'created'
      ? `Sua solicitação foi atendida`
      : status === 'rejected'
      ? `Sua solicitação foi rejeitada`
      : `Status da solicitação atualizado`;
    const body = status === 'created'
      ? `O pedido de agente para a área "${reqRow.area}" foi marcado como criado.`
      : status === 'rejected'
      ? `O pedido de agente para a área "${reqRow.area}" foi rejeitado.`
      : `O pedido de agente para a área "${reqRow.area}" mudou para: ${status}.`;

    const actionUrl = `/agents/requests?highlight=${encodeURIComponent(request_id)}`
    const { error: insErr } = await supabase.from('notifications').insert({
      user_id: reqRow.requester_id,
      organization_id: reqRow.organization_id,
      type: 'agent_request_status',
      title,
      body,
      data: { request_id, status, area: reqRow.area, action_url: actionUrl }
    } as any);
    if (insErr) throw new Error(insErr.message);

    console.log('[notify-request-status] Notificação criada para %s (%s)', reqRow.requester_id, status);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || 'failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
