import React, { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Share2, Users, Copy, Mail, MessageSquare, Settings, Eye, Edit, Trash2, CheckSquare, Square, Info } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/contexts/AppContext';
import { hasPermission } from '@/lib/permissions';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
// Coleções: tipos auxiliares
type CollectionRow = { id: string; organization_id: string; name: string; description: string|null; created_by: string|null; created_at: string };
type CollectionShareRow = { id: string; organization_id: string; collection_id: string; scope_type: 'public'|'user'|'group'; scope_id: string|null; permission: 'view'|'chat'|'edit'|'admin'; created_by: string|null; created_at: string };
type CollectionItemRow = { id: string; organization_id: string; collection_id: string; agent_id: string; added_by: string|null; created_at: string };

type Permission = 'view'|'edit'|'admin';
type TargetType = 'public'|'user'|'group';

type AgentShareRow = {
  id: string;
  organization_id: string;
  agent_id: string;
  target_type: TargetType;
  target_user_id: string | null;
  target_group_id: string | null;
  permission: Permission;
  message: string | null;
  created_by: string;
  created_at: string;
};

export default function AgentSharingPage() {
  const { currentUser, agents, users, organization } = useApp();
  const [activeTab, setActiveTab] = useState<'agent'|'collections'>('agent');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<Permission>('view');
  const [shareMessage, setShareMessage] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [targetType, setTargetType] = useState<TargetType>('public');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState<AgentShareRow[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedShareIds, setSelectedShareIds] = useState<Set<string>>(new Set());
  const [bulkPerm, setBulkPerm] = useState<Permission>('view');

  // Estado para Coleções
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [colName, setColName] = useState<string>('');
  const [colDesc, setColDesc] = useState<string>('');
  const [colLoading, setColLoading] = useState<boolean>(false);
  const [colShares, setColShares] = useState<CollectionShareRow[]>([]);
  const [colItems, setColItems] = useState<CollectionItemRow[]>([]);
  const [colShareTarget, setColShareTarget] = useState<'public'|'user'|'group'>('public');
  const [colShareEmail, setColShareEmail] = useState<string>('');
  const [colShareGroup, setColShareGroup] = useState<string>('');
  const [colSharePerm, setColSharePerm] = useState<'view'|'chat'|'edit'|'admin'>('view');
  const [colEffectivePerm, setColEffectivePerm] = useState<string>('');

  if (!currentUser || !hasPermission(currentUser.role, 'Compartilhar agentes')) {

    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para gerenciar compartilhamento de agentes.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const loadShares = async () => {
    if (!organization?.id) return;
    const { data, error } = await supabase
      .from('agent_shares')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false } as any);
    if (!error) setShares((data || []) as AgentShareRow[]);
  };

  const updateSelectedPermission = async () => {
    if (selectedShareIds.size === 0) return;
    try {
      const ids = Array.from(selectedShareIds);
      const { error } = await supabase.from('agent_shares').update({ permission: bulkPerm } as any).in('id', ids);
      if (error) throw error;
      toast.success(`Permissão atualizada em ${ids.length} compartilhamento(s)`);
      setShares(prev => prev.map(s => selectedShareIds.has(s.id) ? { ...s, permission: bulkPerm } : s));
      setSelectedShareIds(new Set());
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar permissões');
    }
  };

  const toggleSelectShare = (id: string) => {
    setSelectedShareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const revokeSelected = async () => {
    if (selectedShareIds.size === 0) return;
    try {
      if (!window.confirm(`Revogar ${selectedShareIds.size} compartilhamento(s)?`)) return;
      const ids = Array.from(selectedShareIds);
      const { error } = await supabase.from('agent_shares').delete().in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} compartilhamento(s) revogado(s)`);
      setSelectedShareIds(new Set());
      await loadShares();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao revogar selecionados');
    }
  };

  const updateSharePermission = async (shareId: string, newPerm: Permission) => {
    try {
      const { error } = await supabase.from('agent_shares').update({ permission: newPerm } as any).eq('id', shareId);
      if (error) throw error;
      setShares(prev => prev.map(s => s.id === shareId ? { ...s, permission: newPerm } : s));
      toast.success('Permissão atualizada');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar permissão');
    }
  };

  const loadGroups = async () => {
    if (!organization?.id) return;
    const { data, error } = await supabase
      .from('user_groups')
      .select('id, name')
      .eq('organization_id', organization.id)
      .order('name', { ascending: true } as any);
    if (!error) setGroups((data || []) as any);
  };

  useEffect(() => {
    loadShares();
    loadGroups();
    // Carrega coleções
    const loadCollections = async () => {
      if (!organization?.id) return;
      const { data, error } = await supabase
        .from('agent_collections')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false } as any);
      if (!error) setCollections((data || []) as CollectionRow[]);
    };
    loadCollections();
  }, [organization?.id]);

  const handleShareAgent = async () => {
    try {
      if (!organization?.id || !currentUser?.id) return;
      if (!selectedAgent) {
        toast.error('Selecione um agente');
        return;
      }
      setLoading(true);
      if (targetType === 'public') {
        const { error } = await supabase.from('agent_shares').insert({
          organization_id: organization.id,
          agent_id: selectedAgent,
          target_type: 'public',
          permission: sharePermission,
          message: shareMessage || null,
          created_by: currentUser.id,
        } as any);
        if (error) throw error;
        toast.success('Agente compartilhado publicamente na organização');
      } else if (targetType === 'user') {
        if (!shareEmail) {
          toast.error('Informe o email do usuário');
          return;
        }
        const userId = (users.find(u => u.email?.toLowerCase() === shareEmail.toLowerCase()) as any)?.id;
        if (!userId) {
          toast.error('Usuário não encontrado na organização');
          return;
        }
        const { error } = await supabase.from('agent_shares').insert({
          organization_id: organization.id,
          agent_id: selectedAgent,
          target_type: 'user',
          target_user_id: userId,
          permission: sharePermission,
          message: shareMessage || null,
          created_by: currentUser.id,
        } as any);
        if (error) throw error;
        toast.success(`Agente compartilhado com ${shareEmail}`);
      } else if (targetType === 'group') {
        if (!selectedGroup) {
          toast.error('Selecione um grupo');
          return;
        }
        const { error } = await supabase.from('agent_shares').insert({
          organization_id: organization.id,
          agent_id: selectedAgent,
          target_type: 'group',
          target_group_id: selectedGroup,
          permission: sharePermission,
          message: shareMessage || null,
          created_by: currentUser.id,
        } as any);
        if (error) throw error;
        toast.success('Agente compartilhado com o grupo selecionado');
      }
      setSelectedAgent('');
      setShareEmail('');
      setShareMessage('');
      setIsPublic(false);
      await loadShares();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao compartilhar agente');
    } finally {
      setLoading(false);
    }
  };

  const copyShareLink = (agentId: string) => {
    const link = `${window.location.origin}/agents/shared/${agentId}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado para a área de transferência');
  };

  const getPermissionColor = (permission: string) => {
    switch (permission) {
      case 'view': return 'bg-blue-500';
      case 'edit': return 'bg-yellow-500';
      case 'admin': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPermissionLabel = (permission: string) => {
    switch (permission) {
      case 'view': return 'Visualizar';
      case 'edit': return 'Editar';
      case 'admin': return 'Administrar';
      default: return 'Desconhecido';
    }
  };

  const agentNameById = useMemo(() => {
    const agentMap: { [id: string]: string } = {};
    agents.forEach((agent) => {
      agentMap[agent.id] = agent.name;
    });
    return agentMap;
  }, [agents]);

  const userNameById = useMemo(() => {
    const userMap: { [id: string]: string } = {};
    users.forEach((user) => {
      userMap[user.id] = user.name;
    });
    return userMap;
  }, [users]);

  const groupNameById = useMemo(() => {
    const groupMap: { [id: string]: string } = {};
    groups.forEach((group) => {
      groupMap[group.id] = group.name;
    });
    return groupMap;
  }, [groups]);

  const revokeShare = async (shareId: string) => {
    try {
      const { error } = await supabase.from('agent_shares').delete().eq('id', shareId);
      if (error) throw error;
      toast.success('Compartilhamento revogado com sucesso');
      await loadShares();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao revogar compartilhamento');
    }
  };

  return (
    <div className="w-full px-4 md:px-8 py-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <img src="/icons/ai-assistant.gif" alt="Agentes" className="h-8 w-8" width={32} height={32} />
            <h1 className="text-3xl font-bold">Compartilhamento</h1>
          </div>
          <p className="text-muted-foreground">
            Gerencie compartilhamento por agente ou em lote via coleções
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar Agente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Compartilhar Agente</DialogTitle>
              <DialogDescription>
                Compartilhe um agente com outros usuários da organização
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="agent">Agente</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Compartilhar com</Label>
                <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Público (toda a organização)</SelectItem>
                    <SelectItem value="user">Usuário específico</SelectItem>
                    <SelectItem value="group">Grupo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {targetType === 'user' && (
                <div className="grid gap-2">
                  <Label htmlFor="email">Email do usuário</Label>
                  <Input
                    id="email"
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                  />
                </div>
              )}
              {targetType === 'group' && (
                <div className="grid gap-2">
                  <Label htmlFor="group">Grupo</Label>
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="permission">Nível de permissão</Label>
                <Select value={sharePermission} onValueChange={(v: any) => setSharePermission(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Visualizar - Apenas usar o agente</SelectItem>
                    <SelectItem value="edit">Editar - Modificar configurações</SelectItem>
                    <SelectItem value="admin">Administrar - Controle total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="message">Mensagem (opcional)</Label>
                <Textarea
                  id="message"
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  placeholder="Adicione uma mensagem personalizada..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline">Cancelar</Button>
              <Button onClick={handleShareAgent} disabled={loading}>
                <Share2 className="h-4 w-4 mr-2" />
                Compartilhar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Troca de Abas */}
      <div className="flex items-center gap-3">
        <Button variant={activeTab === 'agent' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('agent')}>Por Agente</Button>
        <Button variant={activeTab === 'collections' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('collections')}>Coleções</Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-1" aria-label="Ajuda sobre compartilhamento">
                <Info className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm text-sm leading-relaxed">
              <div className="font-semibold mb-1">Como funciona o Compartilhamento</div>
              <div className="mb-2">
                <span className="font-medium">Por Agente</span>: você compartilha um agente específico com <em>público</em> (toda a organização), <em>usuários</em> ou <em>grupos</em>, e escolhe o nível de permissão (visualizar, editar, administrar).
              </div>
              <div>
                <span className="font-medium">Coleções</span>: você cria conjuntos de agentes e compartilha a coleção toda de uma vez. Ideal para dar acesso em <em>lote</em> a times e manter o controle centralizado.
              </div>
              <div className="mt-2">
                <span className="font-medium">Vantagens</span>:
                <ul className="list-disc ml-5 mt-1">
                  <li>Menos trabalho repetitivo ao conceder acesso a vários agentes.</li>
                  <li>Permissões consistentes para um time inteiro via grupos.</li>
                  <li>Permissão efetiva sempre considera o maior nível entre compartilhamento direto e via coleção.</li>
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agentes Compartilhados</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">+3 este mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
            <p className="text-xs text-muted-foreground">Usuários com acesso</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usos Compartilhados</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,847</div>
            <p className="text-xs text-muted-foreground">Total de interações</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Uso</CardTitle>
            <MessageSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <p className="text-xs text-muted-foreground">Agentes ativamente usados</p>
          </CardContent>
        </Card>
      </div>

      {activeTab === 'agent' && (
      <Card>
        <CardHeader>
          <CardTitle>Agentes Compartilhados</CardTitle>
          <CardDescription>Gerencie todos os compartilhamentos criados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">{shares.length} compartilhamento(s)</div>
            <div className="flex gap-2">
              <Select value={bulkPerm} onValueChange={(v: any) => setBulkPerm(v)}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="Permissão em massa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">Visualizar</SelectItem>
                  <SelectItem value="edit">Editar</SelectItem>
                  <SelectItem value="admin">Administrar</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={updateSelectedPermission} disabled={selectedShareIds.size === 0}>
                Aplicar em Selecionados
              </Button>
              <Button variant="outline" size="sm" onClick={revokeSelected} disabled={selectedShareIds.size === 0}>
                Revogar Selecionados
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {shares.map((s) => (
              <div key={s.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <button className="mr-1" onClick={() => toggleSelectShare(s.id)} title={selectedShareIds.has(s.id) ? 'Desmarcar' : 'Selecionar'}>
                        {selectedShareIds.has(s.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                      <h3 className="font-semibold">{agentNameById[s.agent_id] || s.agent_id}</h3>
                      <Select value={s.permission} onValueChange={(v: any) => updateSharePermission(s.id, v)}>
                        <SelectTrigger className="w-[140px] h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">{getPermissionLabel('view')}</SelectItem>
                          <SelectItem value="edit">{getPermissionLabel('edit')}</SelectItem>
                          <SelectItem value="admin">{getPermissionLabel('admin')}</SelectItem>
                        </SelectContent>
                      </Select>
                      {s.target_type === 'public' && (
                        <Badge variant="outline">Público</Badge>
                      )}
                      {s.target_type === 'user' && s.target_user_id && (
                        <Badge variant="secondary">Usuário: {userNameById[s.target_user_id] || s.target_user_id}</Badge>
                      )}
                      {s.target_type === 'group' && s.target_group_id && (
                        <Badge variant="secondary">Grupo: {groupNameById[s.target_group_id] || s.target_group_id}</Badge>
                      )}
                    </div>
                    {s.message && (
                      <p className="text-sm text-muted-foreground mb-2">{s.message}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Compartilhado em: {new Date(s.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => copyShareLink(s.agent_id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => revokeShare(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {shares.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum compartilhamento encontrado.</p>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {activeTab === 'collections' && (
        <Card className="mt-2">
          <CardHeader>
            <CardTitle>Coleções de Agentes</CardTitle>
            <CardDescription>Crie coleções, adicione agentes e compartilhe em lote</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Criar nova coleção */}
            <div className="grid md:grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Nome da coleção</Label>
                <Input value={colName} onChange={(e) => setColName(e.target.value)} placeholder="Time de Suporte" />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Descrição (opcional)</Label>
                <Input value={colDesc} onChange={(e) => setColDesc(e.target.value)} placeholder="Agentes usados pelo time de suporte" />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button size="sm" disabled={colLoading} onClick={async () => {
                  try {
                    if (!organization?.id || !currentUser?.id) return;
                    if (!colName.trim()) { toast.error('Informe o nome da coleção'); return; }
                    setColLoading(true);
                    const { error } = await supabase.from('agent_collections').insert({
                      organization_id: organization.id,
                      name: colName.trim(),
                      description: colDesc.trim() || null,
                      created_by: currentUser.id,
                    } as any);
                    if (error) throw error;
                    setColName(''); setColDesc('');
                    const { data } = await supabase
                      .from('agent_collections').select('*')
                      .eq('organization_id', organization.id)
                      .order('created_at', { ascending: false } as any);
                    setCollections((data || []) as CollectionRow[]);
                    toast.success('Coleção criada');
                  } catch (e: any) { toast.error(e?.message || 'Falha ao criar coleção'); }
                  finally { setColLoading(false); }
                }}>Nova Coleção</Button>
              </div>
            </div>

            {/* Seleção e detalhe da coleção */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Coleções</Label>
                <div className="border rounded divide-y">
                  {collections.map((c) => (
                    <div key={c.id} className={`p-3 flex items-center justify-between ${selectedCollectionId === c.id ? 'bg-accent/40' : ''}`}> 
                      <button className="text-left flex-1" onClick={async () => {
                        setSelectedCollectionId(c.id);
                        // carregar itens e shares
                        const [itemsRes, sharesRes] = await Promise.all([
                          supabase.from('agent_collection_items').select('*').eq('organization_id', organization!.id).eq('collection_id', c.id).order('created_at', { ascending: false } as any),
                          supabase.from('collection_shares').select('*').eq('organization_id', organization!.id).eq('collection_id', c.id).order('created_at', { ascending: false } as any),
                        ]);
                        if (!itemsRes.error) setColItems((itemsRes.data || []) as CollectionItemRow[]);
                        if (!sharesRes.error) setColShares((sharesRes.data || []) as CollectionShareRow[]);
                        // permissão efetiva da coleção
                        try {
                          const { data: sysOwner } = await supabase.rpc('is_system_owner');
                          if (sysOwner === true) { setColEffectivePerm('admin'); return; }
                        } catch {}
                        try {
                          const { data: eff } = await supabase.rpc('collection_effective_permission', { p_org: organization!.id, p_collection: c.id });
                          const effVal = (Array.isArray(eff) ? (eff as any)[0]?.collection_effective_permission : eff) as string | null;
                          setColEffectivePerm(effVal || 'view');
                        } catch { setColEffectivePerm('view'); }
                      }}>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.description || '—'}</div>
                      </button>
                      <Button variant="outline" size="icon" title="Excluir coleção" onClick={async () => {
                        try {
                          if (!window.confirm('Excluir esta coleção? Esta ação é irreversível.')) return;
                          const { error } = await supabase.from('agent_collections').delete().eq('id', c.id);
                          if (error) throw error;
                          setCollections(prev => prev.filter(x => x.id !== c.id));
                          if (selectedCollectionId === c.id) { setSelectedCollectionId(''); setColItems([]); setColShares([]); }
                          toast.success('Coleção excluída');
                        } catch (e: any) { toast.error(e?.message || 'Falha ao excluir coleção'); }
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  {collections.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground">Nenhuma coleção criada.</div>
                  )}
                </div>
              </div>

              {/* Detalhe da coleção */}
              <div className="md:col-span-2 space-y-6">
                {!selectedCollectionId && (
                  <div className="text-sm text-muted-foreground">Selecione uma coleção para gerenciar itens e compartilhamento.</div>
                )}

                {selectedCollectionId && (
                  <>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">Permissão efetiva:</span>
                      <Badge variant="outline">{colEffectivePerm || '...'}</Badge>
                    </div>
                    {/* Itens (agentes) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Agentes na coleção</Label>
                        <div className="flex gap-2 items-center">
                          <Select onValueChange={async (agentId: string) => {
                            try {
                              if (!organization?.id || !currentUser?.id) return;
                              const { error } = await supabase.from('agent_collection_items').insert({
                                organization_id: organization.id,
                                collection_id: selectedCollectionId,
                                agent_id: agentId,
                                added_by: currentUser.id,
                              } as any);
                              if (error) throw error;
                              const { data } = await supabase.from('agent_collection_items').select('*').eq('organization_id', organization.id).eq('collection_id', selectedCollectionId).order('created_at', { ascending: false } as any);
                              setColItems((data || []) as CollectionItemRow[]);
                              toast.success('Agente adicionado à coleção');
                            } catch (e: any) { toast.error(e?.message || 'Falha ao adicionar agente'); }
                          }}>
                            <SelectTrigger className="w-[260px] h-8 text-xs">
                              <SelectValue placeholder="Adicionar agente à coleção" />
                            </SelectTrigger>
                            <SelectContent>
                              {agents.map(a => (
                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="border rounded divide-y">
                        {colItems.map(it => (
                          <div key={it.id} className="p-2 flex items-center justify-between">
                            <div className="text-sm">{agents.find(a => a.id === it.agent_id)?.name || it.agent_id}</div>
                            <Button variant="outline" size="icon" title="Remover" onClick={async () => {
                              try {
                                const { error } = await supabase.from('agent_collection_items').delete().eq('id', it.id);
                                if (error) throw error;
                                setColItems(prev => prev.filter(x => x.id !== it.id));
                                toast.success('Agente removido da coleção');
                              } catch (e: any) { toast.error(e?.message || 'Falha ao remover'); }
                            }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                        {colItems.length === 0 && (
                          <div className="p-3 text-sm text-muted-foreground">Nenhum agente nesta coleção.</div>
                        )}
                      </div>
                    </div>

                    {/* Compartilhamento da coleção */}
                    <div className="space-y-3">
                      <Label>Compartilhar coleção</Label>
                      <div className="grid md:grid-cols-3 gap-3">
                        <div className="grid gap-2">
                          <Label>Alvo</Label>
                          <Select value={colShareTarget} onValueChange={(v: any) => setColShareTarget(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="public">Público</SelectItem>
                              <SelectItem value="user">Usuário</SelectItem>
                              <SelectItem value="group">Grupo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {colShareTarget === 'user' && (
                          <div className="grid gap-2">
                            <Label>Email</Label>
                            <Input value={colShareEmail} onChange={(e) => setColShareEmail(e.target.value)} placeholder="usuario@empresa.com" />
                          </div>
                        )}
                        {colShareTarget === 'group' && (
                          <div className="grid gap-2">
                            <Label>Grupo</Label>
                            <Select value={colShareGroup} onValueChange={setColShareGroup}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                {groups.map(g => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="grid gap-2">
                          <Label>Permissão</Label>
                          <Select value={colSharePerm} onValueChange={(v: any) => setColSharePerm(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">Visualizar</SelectItem>
                              <SelectItem value="chat">Conversar</SelectItem>
                              <SelectItem value="edit">Editar</SelectItem>
                              <SelectItem value="admin">Administrar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" onClick={async () => {
                          try {
                            if (!organization?.id || !currentUser?.id || !selectedCollectionId) return;
                            if (colShareTarget === 'public') {
                              const { error } = await supabase.from('collection_shares').insert({ organization_id: organization.id, collection_id: selectedCollectionId, scope_type: 'public', scope_id: null, permission: colSharePerm, created_by: currentUser.id } as any);
                              if (error) throw error;
                            } else if (colShareTarget === 'user') {
                              if (!colShareEmail) { toast.error('Informe o e-mail'); return; }
                              const { data: u } = await supabase.from('profiles').select('id,email').eq('email', colShareEmail).limit(1).single();
                              if (!u?.id) { toast.error('Usuário não encontrado'); return; }
                              const { error } = await supabase.from('collection_shares').insert({ organization_id: organization.id, collection_id: selectedCollectionId, scope_type: 'user', scope_id: u.id, permission: colSharePerm, created_by: currentUser.id } as any);
                              if (error) throw error;
                            } else if (colShareTarget === 'group') {
                              if (!colShareGroup) { toast.error('Selecione um grupo'); return; }
                              const { error } = await supabase.from('collection_shares').insert({ organization_id: organization.id, collection_id: selectedCollectionId, scope_type: 'group', scope_id: colShareGroup, permission: colSharePerm, created_by: currentUser.id } as any);
                              if (error) throw error;
                            }
                            const { data } = await supabase.from('collection_shares').select('*').eq('organization_id', organization.id).eq('collection_id', selectedCollectionId).order('created_at', { ascending: false } as any);
                            setColShares((data || []) as CollectionShareRow[]);
                            setColShareEmail(''); setColShareGroup('');
                            toast.success('Coleção compartilhada');
                          } catch (e: any) { toast.error(e?.message || 'Falha ao compartilhar coleção'); }
                        }}>Adicionar compartilhamento</Button>
                      </div>

                      <div className="border rounded divide-y">
                        {colShares.map(cs => (
                          <div key={cs.id} className="p-2 flex items-center justify-between">
                            <div className="text-sm flex items-center gap-2 flex-wrap">
                              <Badge variant="outline">{cs.scope_type}</Badge>
                              {cs.scope_type === 'user' && cs.scope_id && (
                                <span className="text-xs text-muted-foreground">{userNameById[cs.scope_id] || cs.scope_id}</span>
                              )}
                              {cs.scope_type === 'group' && cs.scope_id && (
                                <span className="text-xs text-muted-foreground">{groupNameById[cs.scope_id] || cs.scope_id}</span>
                              )}
                              <Badge>{cs.permission}</Badge>
                            </div>
                            <div className="flex gap-2 items-center">
                              <Select value={cs.permission} onValueChange={async (v: any) => {
                                try {
                                  const { error } = await supabase.from('collection_shares').update({ permission: v } as any).eq('id', cs.id);
                                  if (error) throw error;
                                  setColShares(prev => prev.map(x => x.id === cs.id ? { ...x, permission: v } as any : x));
                                } catch (e: any) { toast.error(e?.message || 'Falha ao atualizar'); }
                              }}>
                                <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="view">Visualizar</SelectItem>
                                  <SelectItem value="chat">Conversar</SelectItem>
                                  <SelectItem value="edit">Editar</SelectItem>
                                  <SelectItem value="admin">Administrar</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="outline" size="icon" onClick={async () => {
                                try {
                                  const { error } = await supabase.from('collection_shares').delete().eq('id', cs.id);
                                  if (error) throw error;
                                  setColShares(prev => prev.filter(x => x.id !== cs.id));
                                } catch (e: any) { toast.error(e?.message || 'Falha ao revogar'); }
                              }}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        ))}
                        {colShares.length === 0 && (
                          <div className="p-3 text-sm text-muted-foreground">Nenhum compartilhamento nesta coleção.</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}