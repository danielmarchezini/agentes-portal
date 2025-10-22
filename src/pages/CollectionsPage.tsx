import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, FolderPlus, Share2, Trash2, Search } from "lucide-react";

interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface AgentRow { id: string; name: string; description: string | null }

export default function CollectionsPage() {
  const { organization, currentUser } = useApp();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showDefaultsModal, setShowDefaultsModal] = useState(false);
  const defaultOptions = [
    { key: 'vendas', name: 'Vendas', description: 'Prospecção, qualificação e CRM' },
    { key: 'suporte', name: 'Suporte', description: 'FAQ, triagem e troubleshooting' },
    { key: 'marketing', name: 'Marketing', description: 'Conteúdo, SEO e campanhas' },
    { key: 'onboarding', name: 'Onboarding', description: 'Treinamentos e guias internos' },
    { key: 'produto', name: 'Produto', description: 'Feedbacks, backlog e releases' },
    { key: 'financeiro', name: 'Financeiro', description: 'Conciliação, relatórios e cobrança' },
    { key: 'rh', name: 'RH / People', description: 'Recrutamento, onboarding e políticas' },
    { key: 'juridico', name: 'Jurídico / Compliance', description: 'Contratos e normativos' },
    { key: 'dados', name: 'Dados & Analytics', description: 'KPIs e insights' },
    { key: 'seguranca', name: 'Segurança da Informação', description: 'Políticas e incidentes' },
    { key: 'operacoes', name: 'Operações / Processos', description: 'SOPs e qualidade' },
  ] as const;
  const [selectedDefaults, setSelectedDefaults] = useState<Set<string>>(new Set());
  const [defaultPrefix, setDefaultPrefix] = useState("");
  const [autoCreateGroups, setAutoCreateGroups] = useState(false);
  const [defaultSharePerm, setDefaultSharePerm] = useState<"view"|"chat"|"edit"|"admin">("chat");

  // Manage agents dialog
  const [manageCollId, setManageCollId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [agentFilter, setAgentFilter] = useState("");
  const [collAgentIds, setCollAgentIds] = useState<string[]>([]);

  // Sharing dialog
  const [shareCollId, setShareCollId] = useState<string | null>(null);
  const [shares, setShares] = useState<any[]>([]);
  const [shareType, setShareType] = useState<"public"|"user"|"group">("public");
  const [shareTarget, setShareTarget] = useState<string>("");
  const [sharePerm, setSharePerm] = useState<"view"|"chat"|"edit"|"admin">("view");

  const filteredAgents = useMemo(() => {
    const q = (agentFilter || "").toLowerCase();
    return agents.filter(a => (a.name||"").toLowerCase().includes(q));
  }, [agents, agentFilter]);

  const loadCollections = async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('agent_collections')
      .select('id, name, description, created_at')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false } as any);
    setLoading(false);
    if (error) { toast({ title: 'Erro ao carregar coleções', description: error.message, variant: 'destructive' }); return; }
    setCollections((data || []) as any);
  };

  useEffect(() => { loadCollections(); }, [organization?.id]);

  const createCollection = async () => {
    if (!newName.trim() || !organization?.id) return;
    const payload: any = { organization_id: organization.id, name: newName.trim(), description: newDesc || null, created_by: currentUser?.id || null };
    const { error } = await supabase.from('agent_collections').insert(payload);
    if (error) { toast({ title: 'Erro ao criar coleção', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Coleção criada' });
    setShowNew(false); setNewName(""); setNewDesc("");
    loadCollections();
  };

  const toggleDefault = (key: string) => {
    setSelectedDefaults(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const createSelectedDefaults = async () => {
    if (!organization?.id) return;
    if (selectedDefaults.size === 0) {
      toast({ title: 'Selecione pelo menos uma coleção', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const chosen = defaultOptions.filter(o => selectedDefaults.has(o.key));
      const rows = chosen.map(d => ({
        organization_id: organization.id,
        name: d.name,
        description: d.description,
        created_by: currentUser?.id || null
      }));
      const insertRes = await supabase.from('agent_collections').insert(rows as any).select('id,name');
      if (insertRes.error) throw insertRes.error;
      const createdCollections = insertRes.data as Array<{ id: string; name: string }>;

      if (autoCreateGroups) {
        // criar grupos correspondentes e compartilhar coleção com o grupo
        for (const col of createdCollections) {
          const groupName = `${defaultPrefix || ''}${col.name}`.trim();
          const grpRes = await supabase.from('user_groups').insert({
            organization_id: organization.id,
            name: groupName,
            description: `Grupo para a coleção ${col.name}`,
            created_by: currentUser?.id || null,
          } as any).select('id').single();
          if (grpRes.error) throw grpRes.error;
          const groupId = grpRes.data.id as string;

          const shareRes = await supabase.from('collection_shares').insert({
            organization_id: organization.id,
            collection_id: col.id,
            scope_type: 'group',
            scope_id: groupId,
            permission: defaultSharePerm,
            created_by: currentUser?.id || null,
          } as any);
          if (shareRes.error) throw shareRes.error;
        }
      }
      toast({ title: 'Coleções padrão criadas' });
      setShowDefaultsModal(false);
      setSelectedDefaults(new Set());
      await loadCollections();
    } catch (e: any) {
      toast({ title: 'Erro ao criar coleções', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const deleteCollection = async (id: string) => {
    const { error } = await supabase.from('agent_collections').delete().eq('id', id);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Coleção excluída' });
    setCollections(prev => prev.filter(c => c.id !== id));
  };

  const openManageAgents = async (collectionId: string) => {
    setManageCollId(collectionId);
    // Load all agents
    const { data: ags } = await supabase
      .from('agents')
      .select('id, name, description')
      .eq('organization_id', organization?.id || '');
    setAgents((ags || []) as any);
    // Load existing items
    const { data: items } = await supabase
      .from('agent_collection_items')
      .select('agent_id')
      .eq('collection_id', collectionId)
      .eq('organization_id', organization?.id || '');
    setCollAgentIds((items || []).map((i: any) => i.agent_id));
  };

  const toggleAgentInCollection = async (agentId: string, present: boolean) => {
    if (!manageCollId || !organization?.id) return;
    if (present) {
      // remove
      const { error } = await supabase
        .from('agent_collection_items')
        .delete()
        .eq('collection_id', manageCollId)
        .eq('organization_id', organization.id)
        .eq('agent_id', agentId);
      if (error) { toast({ title: 'Erro ao remover agente', description: error.message, variant: 'destructive' }); return; }
      setCollAgentIds(prev => prev.filter(id => id !== agentId));
    } else {
      const { error } = await supabase
        .from('agent_collection_items')
        .insert({ collection_id: manageCollId, organization_id: organization.id, agent_id: agentId, added_by: currentUser?.id || null });
      if (error) { toast({ title: 'Erro ao adicionar agente', description: error.message, variant: 'destructive' }); return; }
      setCollAgentIds(prev => [...prev, agentId]);
    }
  };

  const openShare = async (collectionId: string) => {
    setShareCollId(collectionId);
    const { data } = await supabase
      .from('collection_shares')
      .select('id, scope_type, scope_id, permission, created_at')
      .eq('collection_id', collectionId)
      .eq('organization_id', organization?.id || '');
    setShares((data || []) as any);
  };

  const addShare = async () => {
    if (!shareCollId || !organization?.id) return;
    const payload: any = { collection_id: shareCollId, organization_id: organization.id, scope_type: shareType, permission: sharePerm, created_by: currentUser?.id || null };
    if (shareType === 'user' || shareType === 'group') {
      if (!shareTarget) { toast({ title: 'Informe o alvo', description: 'Selecione o usuário ou grupo', variant: 'destructive' }); return; }
      payload.scope_id = shareTarget;
    } else {
      payload.scope_id = null;
    }
    const { error } = await supabase.from('collection_shares').insert(payload);
    if (error) { toast({ title: 'Erro ao compartilhar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Compartilhamento adicionado' });
    openShare(shareCollId);
  };

  const removeShare = async (id: string) => {
    const { error } = await supabase.from('collection_shares').delete().eq('id', id);
    if (error) { toast({ title: 'Erro ao remover compartilhamento', description: error.message, variant: 'destructive' }); return; }
    setShares(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Coleções de Agentes</h1>
            {organization?.name && (
              <Badge variant="outline">Org: {organization.name}</Badge>
            )}
          </div>
          <p className="text-muted-foreground">Agrupe agentes e compartilhe em lote com usuários e grupos</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowNew(true)} className="bg-gradient-primary"><FolderPlus className="w-4 h-4 mr-2"/>Nova Coleção</Button>
          <Button variant="outline" onClick={loadCollections}><Search className="w-4 h-4 mr-2"/>Atualizar</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {collections.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{c.name}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openManageAgents(c.id)} title="Gerenciar agentes"><Users className="w-4 h-4"/></Button>
                  <Button size="sm" variant="outline" onClick={() => openShare(c.id)} title="Compartilhar"><Share2 className="w-4 h-4"/></Button>
                  <Button size="sm" variant="outline" onClick={() => deleteCollection(c.id)} title="Excluir"><Trash2 className="w-4 h-4"/></Button>
                </div>
              </CardTitle>
              {c.description && (<CardDescription>{c.description}</CardDescription>)}
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">Criada em {new Date(c.created_at).toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>
        ))}
        {collections.length === 0 && !loading && (
          <Card>
            <CardHeader>
              <CardTitle>Nenhuma coleção encontrada</CardTitle>
              <CardDescription>Crie sua primeira coleção ou use o atalho abaixo para iniciar com sugestões.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button onClick={() => setShowNew(true)}><FolderPlus className="w-4 h-4 mr-2"/>Nova Coleção</Button>
                <Button variant="outline" onClick={() => setShowDefaultsModal(true)}><Plus className="w-4 h-4 mr-2"/>Criar coleções padrão</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Nova coleção */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Coleção</DialogTitle>
            <DialogDescription>Informe um nome e uma descrição opcional</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Time de Vendas"/>
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Opcional"/>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button onClick={createCollection} className="bg-gradient-primary">Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gerenciar agentes na coleção */}
      <Dialog open={!!manageCollId} onOpenChange={(o) => !o && setManageCollId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Agentes da Coleção</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/>
              <Input className="pl-10" placeholder="Buscar agentes..." value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} />
            </div>
            <div className="max-h-80 overflow-auto space-y-1 border rounded p-2">
              {filteredAgents.map(a => {
                const present = collAgentIds.includes(a.id);
                return (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                    <div>
                      <div className="font-medium">{a.name}</div>
                      {a.description && (<div className="text-xs text-muted-foreground">{a.description}</div>)}
                    </div>
                    <Button size="sm" variant={present ? 'outline' : 'default'} onClick={() => toggleAgentInCollection(a.id, present)}>
                      {present ? 'Remover' : 'Adicionar'}
                    </Button>
                  </div>
                );
              })}
              {filteredAgents.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhum agente encontrado.</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compartilhar coleção */}
      <Dialog open={!!shareCollId} onOpenChange={(o) => !o && setShareCollId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compartilhar Coleção</DialogTitle>
            <DialogDescription>Defina quem pode acessar todos os agentes desta coleção</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="w-40">
                <label className="text-sm font-medium">Escopo</label>
                <Select value={shareType} onValueChange={(v: any) => setShareType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Público</SelectItem>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="group">Grupo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(shareType === 'user' || shareType === 'group') && (
                <div className="flex-1">
                  <label className="text-sm font-medium">ID do alvo</label>
                  <Input placeholder={shareType === 'user' ? 'user_id' : 'group_id'} value={shareTarget} onChange={(e) => setShareTarget(e.target.value)} />
                </div>
              )}
              <div className="w-40">
                <label className="text-sm font-medium">Permissão</label>
                <Select value={sharePerm} onValueChange={(v: any) => setSharePerm(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Visualizar</SelectItem>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="edit">Editar</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="self-end">
                <Button onClick={addShare}><Share2 className="w-4 h-4 mr-2"/>Adicionar</Button>
              </div>
            </div>

            <div className="space-y-2">
              {shares.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum compartilhamento configurado.</div>
              ) : shares.map((s) => (
                <div key={s.id} className="flex items-center justify-between border rounded p-2">
                  <div className="text-sm">
                    <Badge variant="secondary" className="mr-2">{s.scope_type}</Badge>
                    <span className="mr-2">{s.scope_id || '—'}</span>
                    <Badge className="mr-2">{s.permission}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => removeShare(s.id)}><Trash2 className="w-4 h-4 mr-1"/>Remover</Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Seleção de Coleções Padrão */}
      <Dialog open={showDefaultsModal} onOpenChange={setShowDefaultsModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Criar coleções padrão</DialogTitle>
            <DialogDescription>Selecione as coleções que deseja criar</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 mb-2">
            <div>
              <label className="text-sm font-medium">Prefixo de nome (opcional)</label>
              <Input value={defaultPrefix} onChange={(e) => setDefaultPrefix(e.target.value)} placeholder="Ex.: Corp - " />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={autoCreateGroups} onCheckedChange={setAutoCreateGroups} />
              <div>
                <div className="text-sm font-medium">Criar grupos correspondentes e compartilhar automaticamente</div>
                <div className="text-xs text-muted-foreground">Um grupo por coleção com o nome: prefixo + nome da coleção</div>
              </div>
            </div>
            {autoCreateGroups && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Permissão inicial</label>
                <Select value={defaultSharePerm} onValueChange={(v: any) => setDefaultSharePerm(v)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Visualizar</SelectItem>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="edit">Editar</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {defaultOptions.map(opt => {
              const active = selectedDefaults.has(opt.key);
              return (
                <Button key={opt.key}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  className="justify-start h-auto py-3"
                  onClick={() => toggleDefault(opt.key)}>
                  <div className="text-left">
                    <div className="font-medium">{opt.name}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </div>
                </Button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDefaultsModal(false)}>Cancelar</Button>
            <Button onClick={createSelectedDefaults} disabled={loading}>Criar Selecionadas</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
