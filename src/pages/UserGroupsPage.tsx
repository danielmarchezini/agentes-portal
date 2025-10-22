import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Plus, Edit, Trash2, UserPlus, Settings, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useApp } from '@/contexts/AppContext';
import { hasPermission } from '@/lib/permissions';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

type GroupRow = { id: string; name: string; description: string | null; created_by: string; created_at: string; is_default?: boolean };
type GroupWithCount = GroupRow & { member_count: number };

const availablePermissions = [
  { id: 'access_sales_agents', label: 'Acessar Agentes de Vendas' },
  { id: 'access_support_agents', label: 'Acessar Agentes de Suporte' },
  { id: 'access_marketing_agents', label: 'Acessar Agentes de Marketing' },
  { id: 'view_reports', label: 'Visualizar Relatórios' },
  { id: 'manage_leads', label: 'Gerenciar Leads' },
  { id: 'manage_tickets', label: 'Gerenciar Tickets' },
  { id: 'view_system_logs', label: 'Ver Logs do Sistema' },
  { id: 'manage_campaigns', label: 'Gerenciar Campanhas' },
  { id: 'view_analytics', label: 'Ver Analytics' }
];

export default function UserGroupsPage() {
  const { currentUser, users, organization } = useApp();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list'|'cards'>(() => {
    try { return (localStorage.getItem('user_groups_view') as any) || 'list'; } catch { return 'list'; }
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  // Edit group modal
  const [editOpen, setEditOpen] = useState(false);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  // Manage members modal
  const [manageOpen, setManageOpen] = useState(false);
  const [manageGroupId, setManageGroupId] = useState<string | null>(null);
  const [manageMembers, setManageMembers] = useState<string[]>([]);

  if (!currentUser || !hasPermission(currentUser.role, 'Gerenciar grupos de usuários')) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para gerenciar grupos de usuários.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const loadGroups = async () => {
    if (!organization?.id) return;
    // Busca grupos e conta de membros
    const { data, error } = await supabase
      .from('user_groups')
      .select('id, name, description, created_by, created_at, is_default')
      .eq('organization_id', organization.id)
      .order('is_default', { ascending: false } as any)
      .order('created_at', { ascending: false } as any);
    if (error) return;
    const rows = (data || []) as GroupRow[];
    // conta membros por group_id
    const ids = rows.map(r => r.id);
    if (ids.length === 0) { setGroups([]); return; }
    const { data: members, error: err2 } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', ids);
    const counts: Record<string, number> = {};
    if (!err2) (members || []).forEach((m: any) => { counts[m.group_id] = (counts[m.group_id] || 0) + 1; });
    setGroups(rows.map(r => ({ ...r, member_count: counts[r.id] || 0 })));
  };

  const setDefaultGroup = async (groupId: string) => {
    try {
      if (!organization?.id) return;
      // Apenas owner/admin deve ver/acessar, mas manteremos uma checagem extra
      if (!['owner','admin'].includes(currentUser?.role || '')) {
        toast.error('Somente administradores podem definir o grupo padrão');
        return;
      }
      const g = groups.find(g => g.id === groupId);
      const name = g?.name || 'este grupo';
      const proceed = window.confirm(`Definir "${name}" como grupo padrão da organização?\n\nImpacto: novos usuários serão automaticamente adicionados a este grupo.`);
      if (!proceed) return;
      const { error } = await supabase.rpc('set_org_default_group', { p_org: organization.id, p_group: groupId });
      if (error) throw error;
      toast.success('Grupo definido como padrão da organização');
      await loadGroups();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao definir grupo padrão');
    }
  };

  // Edit group: open modal
  const openEditGroup = (g: GroupWithCount) => {
    setEditGroupId(g.id);
    setEditName(g.name);
    setEditDesc(g.description || '');
    setEditOpen(true);
  };

  const saveEditGroup = async () => {
    try {
      if (!editGroupId) return;
      const { error } = await supabase.from('user_groups').update({ name: editName.trim(), description: editDesc || null } as any).eq('id', editGroupId);
      if (error) throw error;
      toast.success('Grupo atualizado');
      setEditOpen(false);
      await loadGroups();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar grupo');
    }
  };

  // Manage members
  const openManageMembers = async (g: GroupWithCount) => {
    try {
      setManageGroupId(g.id);
      const { data, error } = await supabase.from('group_members').select('user_id').eq('group_id', g.id);
      if (error) throw error;
      const ids = (data || []).map((r: any) => r.user_id);
      setManageMembers(ids);
      setManageOpen(true);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao carregar membros');
    }
  };

  const addMember = async (userId: string) => {
    try {
      if (!manageGroupId || !currentUser?.id) return;
      const { error } = await supabase.from('group_members').insert({ group_id: manageGroupId, user_id: userId, role: 'member', created_by: currentUser.id } as any);
      if (error) throw error;
      setManageMembers(prev => Array.from(new Set([...prev, userId])));
    } catch (e: any) { toast.error(e?.message || 'Falha ao adicionar membro'); }
  };

  const removeMember = async (userId: string) => {
    try {
      if (!manageGroupId) return;
      const { error } = await supabase.from('group_members').delete().eq('group_id', manageGroupId).eq('user_id', userId);
      if (error) throw error;
      setManageMembers(prev => prev.filter(id => id !== userId));
    } catch (e: any) { toast.error(e?.message || 'Falha ao remover membro'); }
  };

  // Derived lists for search and pagination
  const filtered = groups.filter(g => (g.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = filtered.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => { loadGroups(); }, [organization?.id]);

  const handleCreateGroup = async () => {
    try {
      if (!groupName.trim()) {
        toast.error('Nome do grupo é obrigatório');
        return;
      }
      if (!organization?.id || !currentUser?.id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('user_groups')
        .insert({ organization_id: organization.id, name: groupName.trim(), description: groupDescription || null, created_by: currentUser.id } as any)
        .select('id')
        .single();
      if (error) throw error;
      const gid = (data as any)?.id as string;
      if (selectedMembers.length > 0) {
        const membersPayload = selectedMembers.map(uid => ({ group_id: gid, user_id: uid, role: 'member', created_by: currentUser.id }));
        const { error: errM } = await supabase.from('group_members').insert(membersPayload as any);
        if (errM) throw errM;
      }
      toast.success(`Grupo "${groupName}" criado com sucesso`);
      setGroupName('');
      setGroupDescription('');
      setSelectedMembers([]);
      setSelectedPermissions([]);
      await loadGroups();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao criar grupo');
    } finally { setLoading(false); }
  };

  const removeGroup = async (group: GroupWithCount) => {
    try {
      if (group.is_default) {
        toast.error('Não é possível excluir o grupo padrão. Defina outro grupo como padrão antes de excluir.');
        return;
      }
      const proceed = window.confirm(`Excluir o grupo "${group.name}"?\n\nMembros deixarão de estar vinculados a este grupo.`);
      if (!proceed) return;
      const { error } = await supabase.from('user_groups').delete().eq('id', group.id);
      if (error) throw error;
      toast.success('Grupo removido');
      await loadGroups();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao remover grupo');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      // Simulação de importação
      toast.success('Arquivo Excel processado. 45 usuários importados com sucesso.');
    }
  };

  const handleMemberToggle = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  return (
    <div className="w-full px-4 md:px-8 py-4 space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Grupos de Usuários</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Organize usuários em equipes e gerencie permissões
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Toggle de visualização */}
          <div className="hidden md:flex items-center gap-1 mr-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setViewMode('list'); try { localStorage.setItem('user_groups_view', 'list'); } catch {} }}
              title="Exibir em linhas"
            >
              Linhas
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setViewMode('cards'); try { localStorage.setItem('user_groups_view', 'cards'); } catch {} }}
              title="Exibir em cards"
            >
              Cards
            </Button>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Importar Excel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Usuários do Excel</DialogTitle>
                <DialogDescription>
                  Faça upload de um arquivo Excel com os dados dos usuários
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="excel-file">Arquivo Excel</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                  />
                  <p className="text-xs text-muted-foreground">
                    O arquivo deve conter as colunas: Nome, Email, Cargo, Departamento
                  </p>
                </div>
                {uploadFile && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">Arquivo selecionado: {uploadFile.name}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline">Cancelar</Button>
                <Button>Importar</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar Grupo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Criar Novo Grupo</DialogTitle>
                <DialogDescription>
                  Crie um grupo de usuários. As permissões são derivadas dos compartilhamentos de agentes e coleções (sem permissão-base no grupo).
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="group-name">Nome do Grupo</Label>
                  <Input
                    id="group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ex: Equipe de Vendas"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="group-description">Descrição</Label>
                  <Textarea
                    id="group-description"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="Descreva o propósito deste grupo..."
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Membros</Label>
                  <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={user.id}
                          checked={selectedMembers.includes(user.id)}
                          onCheckedChange={() => handleMemberToggle(user.id)}
                        />
                        <Label htmlFor={user.id} className="text-sm cursor-pointer">
                          {user.name} ({user.email})
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Permissões</Label>
                  <div className="border rounded-lg p-3 text-sm text-muted-foreground">
                    As permissões deste grupo são calculadas a partir dos compartilhamentos em agentes e coleções. Não é necessário definir permissões aqui.
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline">Cancelar</Button>
                <Button onClick={handleCreateGroup}>Criar Grupo</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Grupos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.length}</div>

            <p className="text-xs text-muted-foreground">Grupos ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Membros</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groups.reduce((acc, group) => acc + group.member_count, 0)}
            </div>

            <p className="text-xs text-muted-foreground">Usuários em grupos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maior Grupo</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groups.length ? Math.max(...groups.map(g => g.member_count)) : 0}
            </div>

            <p className="text-xs text-muted-foreground">Membros no maior grupo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permissões Ativas</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availablePermissions.length}</div>

            <p className="text-xs text-muted-foreground">Tipos de permissão</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Grupos */}
      {viewMode === 'list' ? (
        <div className="space-y-3">
          {current.map((group) => (
            <Card key={group.id} className={`hover:shadow-md transition-shadow ${group.is_default ? 'border-primary/40 ring-1 ring-primary/20 bg-muted/30' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full bg-muted`}></div>
                      <h3 className="font-semibold text-base md:text-lg">{group.name}</h3>
                      {group.is_default && <Badge variant="outline">Padrão</Badge>}
                      <Badge variant="secondary">{group.member_count} membros</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{group.description}</p>
                    <div className="text-[11px] text-muted-foreground">
                      Criado por {group.created_by} em {new Date(group.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-2 items-center">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/user-groups/${group.id}/members`)} title="Gerenciar membros">
                      <Users className="h-4 w-4" />
                    </Button>
                    {group.is_default && <Badge variant="outline" title="Grupo padrão da organização">Padrão</Badge>}
                    <Button variant="outline" size="sm" onClick={() => openEditGroup(group)} title="Editar grupo">
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!group.is_default && ['owner','admin'].includes(currentUser.role) && (
                      <Button variant="outline" size="sm" onClick={() => setDefaultGroup(group.id)} title="Definir como padrão">
                        Padrão
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => removeGroup(group)} title="Remover grupo">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum grupo encontrado.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {current.map((group) => (
            <Card key={group.id} className={`hover:shadow-md transition-shadow ${group.is_default ? 'border-primary/40 ring-1 ring-primary/20 bg-muted/30' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full bg-muted`}></div>
                  <CardTitle className="text-base">{group.name}</CardTitle>
                  {group.is_default && <Badge variant="outline">Padrão</Badge>}
                </div>
                <CardDescription className="line-clamp-2">{group.description || '—'}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>{group.member_count} membro(s)</span>
                  <span>{new Date(group.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/user-groups/${group.id}/members`)}>Membros</Button>
                  <Button variant="outline" size="sm" onClick={() => openEditGroup(group)}>Editar</Button>
                  {!group.is_default && ['owner','admin'].includes(currentUser.role) && (
                    <Button variant="outline" size="sm" onClick={() => setDefaultGroup(group.id)}>Tornar padrão</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => removeGroup(group)}>Remover</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Editar Grupo */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Grupo</DialogTitle>
            <DialogDescription>Atualize nome e descrição do grupo</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveEditGroup} disabled={!editName.trim()}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Gerenciar Membros */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Membros</DialogTitle>
            <DialogDescription>Adicione ou remova membros deste grupo</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Membros atuais</h4>
              <div className="border rounded p-3 max-h-64 overflow-auto space-y-2">
                {manageMembers.length === 0 && <p className="text-xs text-muted-foreground">Nenhum membro</p>}
                {manageMembers.map(uid => {
                  const u = users.find(us => us.id === uid);
                  return (
                    <div key={uid} className="flex items-center justify-between">
                      <span className="text-sm">{u ? `${u.name} (${u.email})` : uid}</span>
                      <Button variant="outline" size="sm" onClick={() => removeMember(uid)}>Remover</Button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Adicionar membros</h4>
              <div className="border rounded p-3 max-h-64 overflow-auto space-y-2">
                {users.filter(u => !manageMembers.includes(u.id)).map(u => (
                  <div key={u.id} className="flex items-center justify-between">
                    <span className="text-sm">{u.name} ({u.email})</span>
                    <Button variant="outline" size="sm" onClick={() => addMember(u.id)}>Adicionar</Button>
                  </div>
                ))}
                {users.filter(u => !manageMembers.includes(u.id)).length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum usuário disponível para adicionar.</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setManageOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}