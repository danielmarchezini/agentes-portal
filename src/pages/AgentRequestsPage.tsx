import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabaseClient";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";

interface AgentRequestRow {
  id: string;
  organization_id: string;
  requester_id: string;
  requester_name: string;
  area: string;
  description: string;
  is_public: boolean;
  status: "pending" | "created" | "rejected";
  agent_id: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  attachments?: Array<{ path: string; name: string; size: number }>;
}

export default function AgentRequestsPage() {
  const { currentUser, organization } = useApp();
  const location = useLocation();
  const [items, setItems] = useState<AgentRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // Filtros
  const [filterStatus, setFilterStatus] = useState<'all'|'pending'|'created'|'rejected'>('all');
  const [searchArea, setSearchArea] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const canProcess = currentUser ? hasPermission(currentUser.role, "Processar solicitações de agentes") : false;
  const canViewAll = currentUser ? (hasPermission(currentUser.role, "Processar solicitações de agentes") || currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.role === 'bot_manager') : false;

  // Novo: criação de solicitações
  const [newOpen, setNewOpen] = useState(false);
  const [newArea, setNewArea] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPublic, setNewPublic] = useState(false);
  const [newFiles, setNewFiles] = useState<FileList | null>(null);
  const [creating, setCreating] = useState(false);

  const resetNewForm = () => {
    setNewArea("");
    setNewDescription("");
    setNewPublic(false);
    setNewFiles(null);
  };

  const load = async () => {
    try {
      setLoading(true);
      if (!organization?.id) {
        // Para membros sem organização ativa, não há como listar
        setItems([]);
        return;
      }
      let query = supabase
        .from("agent_requests")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false } as any);
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      if (searchArea.trim().length > 0) {
        query = (query as any).ilike('area', `%${searchArea.trim()}%`);
      }
      // Membros veem apenas as próprias solicitações
      if (!canViewAll && currentUser?.id) {
        query = query.eq('requester_id', currentUser.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      setItems((data || []) as AgentRequestRow[]);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar solicitações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [organization?.id, filterStatus, searchArea]);

  // Ler query param highlight e rolar até o item quando carregar
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const h = params.get('highlight');
    if (h) setHighlightedId(h);
  }, [location.search]);

  useEffect(() => {
    if (!highlightedId) return;
    // aguarda render
    const tid = setTimeout(() => {
      const el = document.getElementById(`req-${highlightedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
    // remover highlight após alguns segundos
    const clearTid = setTimeout(() => setHighlightedId(null), 6000);
    return () => { clearTimeout(tid); clearTimeout(clearTid); };
  }, [highlightedId, items.length]);

  const handleUploadAttachments = async (): Promise<Array<{ path: string; name: string; size: number }>> => {
    const result: Array<{ path: string; name: string; size: number }> = [];
    if (!newFiles || newFiles.length === 0) return result;
    if (!organization?.id || !currentUser?.id) return result;
    for (const f of Array.from(newFiles)) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const key = `${organization.id}/${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext || 'bin'}`;
      const { error } = await supabase.storage.from('agent-request-files').upload(key, f, {
        cacheControl: '3600',
        upsert: false
      });
      if (!error) {
        result.push({ path: key, name: f.name, size: f.size });
      } else {
        toast.warning(`Falha ao anexar ${f.name}: ${error.message || 'erro'}`);
      }
    }
    return result;
  };

  const handleCreate = async () => {
    try {
      if (!currentUser?.id || !organization?.id) {
        toast.error('Sessão/Organização não encontrada.');
        return;
      }
      if (!newArea || !newDescription) {
        toast.error('Informe área e descrição.');
        return;
      }
      setCreating(true);
      const attachments = await handleUploadAttachments();
      const payload: any = {
        organization_id: organization.id,
        requester_id: currentUser.id,
        requester_name: currentUser.name || currentUser.email || 'Usuário',
        area: newArea,
        description: newDescription,
        is_public: !!newPublic,
        status: 'pending',
        attachments
      };
      const { error } = await supabase.from('agent_requests').insert(payload);
      if (error) throw error;
      toast.success('Solicitação enviada!');
      setNewOpen(false);
      resetNewForm();
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao enviar solicitação');
    } finally {
      setCreating(false);
    }
  };

  const markCreated = async (req: AgentRequestRow) => {
    try {
      if (!canProcess) return;
      const { error } = await supabase
        .from("agent_requests")
        .update({ status: "created", processed_by: currentUser!.id, processed_at: new Date().toISOString() } as any)
        .eq("id", req.id);
      if (error) throw error;
      // Notifica solicitante (edge function opcional)
      try { await supabase.functions.invoke('notify-request-status', { body: { request_id: req.id, status: 'created' } }); } catch {}
      toast.success("Solicitação marcada como criada");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar");
    }
  };

  const markRejected = async (req: AgentRequestRow) => {
    try {
      if (!canProcess) return;
      const { error } = await supabase
        .from("agent_requests")
        .update({ status: "rejected", processed_by: currentUser!.id, processed_at: new Date().toISOString() } as any)
        .eq("id", req.id);
      if (error) throw error;
      // Notifica solicitante (edge function opcional)
      try { await supabase.functions.invoke('notify-request-status', { body: { request_id: req.id, status: 'rejected' } }); } catch {}
      toast.success("Solicitação rejeitada");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar");
    }
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Solicitações de Agentes</h1>
          <p className="text-muted-foreground">Gerencie pedidos de criação de agentes feitos por membros</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center justify-end">
          <div className="flex items-center gap-2">
            <Input placeholder="Buscar por área" value={searchArea} onChange={(e) => setSearchArea(e.target.value)} className="w-[200px]" />
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="created">Criado</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>Recarregar</Button>
          {currentUser && hasPermission(currentUser.role, 'Ver solicitações de agentes') && (
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary">Nova Solicitação</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nova Solicitação de Agente</DialogTitle>
                  <DialogDescription>Descreva a necessidade e anexe materiais de referência se necessário.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Área/Departamento</Label>
                    <Input placeholder="Ex.: Suporte, Vendas, Financeiro" value={newArea} onChange={(e) => setNewArea(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea placeholder="Explique o objetivo do agente, exemplos de perguntas, integrações necessárias, etc." value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="min-h-28" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Divulgação</Label>
                      <div className="text-xs text-muted-foreground">Se público, o agente poderá ser disponibilizado para todos na organização.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Privado</span>
                      <Switch checked={newPublic} onCheckedChange={setNewPublic} />
                      <span className="text-sm">Público</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Anexos (opcional)</Label>
                    <Input type="file" multiple onChange={(e) => setNewFiles(e.target.files)} />
                    <div className="text-xs text-muted-foreground">Arquivos serão armazenados com segurança e anexados à solicitação.</div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { resetNewForm(); setNewOpen(false); }} disabled={creating}>Cancelar</Button>
                  <Button onClick={handleCreate} disabled={creating} className="bg-gradient-primary">{creating ? 'Enviando…' : 'Enviar Solicitação'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitações</CardTitle>
          <CardDescription>
            {items.length} registro(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((r) => (
            <div id={`req-${r.id}`} key={r.id} className={`border rounded-lg p-4 space-y-3 transition-shadow ${highlightedId === r.id ? 'ring-2 ring-primary shadow-lg' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{r.area}</Badge>
                  {r.is_public && <Badge className="bg-blue-600">Público</Badge>}
                  <Badge variant={r.status === 'pending' ? 'outline' : r.status === 'created' ? 'default' : 'destructive'}>
                    {r.status === 'pending' ? 'Pendente' : r.status === 'created' ? 'Criado' : 'Rejeitado'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('pt-BR')}</div>
              </div>
              <div className="text-sm text-muted-foreground">Solicitante: {r.requester_name}</div>
              <div className="whitespace-pre-wrap">{r.description}</div>
              {Array.isArray(r.attachments) && r.attachments.length > 0 && (
                <div className="pt-2">
                  <div className="text-sm font-medium mb-2">Anexos</div>
                  <div className="flex flex-wrap gap-2">
                    {r.attachments.map((a, idx) => (
                      <Button key={`${a.path}-${idx}`} variant="outline" size="sm" onClick={async () => {
                        try {
                          const { data, error } = await supabase.storage.from('agent-request-files').createSignedUrl(a.path, 60 * 10);
                          if (error || !data?.signedUrl) throw error || new Error('Falha ao gerar link');
                          window.open(data.signedUrl, '_blank');
                        } catch (e: any) {
                          toast.error(e?.message || 'Falha ao baixar anexo');
                        }
                      }}>
                        {a.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {canProcess && r.status === 'pending' && (
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => markRejected(r)}>Rejeitar</Button>
                  <Button onClick={() => navigate(`/agents/new?name=${encodeURIComponent('Agente ' + r.area)}&description=${encodeURIComponent(r.description)}&category=${encodeURIComponent(r.area)}&public=${r.is_public ? '1' : '0'}`)} variant="outline">Criar agente</Button>
                  <Button onClick={() => markCreated(r)} className="bg-gradient-primary">Marcar como criado</Button>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhuma solicitação encontrada.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
