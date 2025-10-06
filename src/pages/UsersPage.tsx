import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Users, Plus, Search, Mail, UserPlus, MoreVertical, Send } from "lucide-react";
import { hasPermission, getRoleLabel, getRoleIcon } from "@/lib/permissions";
import { UserRole } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabaseClient";

const UsersPage = () => {
  const { currentUser, users, setUsers, organization, requestLogin, supportMode } = useApp();
  const safeUsers = Array.isArray(users) ? users : [];
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [density, setDensity] = useState<'normal'|'compact'>(() => {
    try { return (localStorage.getItem('users_density') as any) || 'normal'; } catch { return 'normal'; }
  });
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all'|'active'|'inactive'|'pending'>('all');
  const [sortBy, setSortBy] = useState<'name'|'email'|'role'|'status'|'last_login'>('name');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("member");
  const [invites, setInvites] = useState<{ id: string; email: string; role: UserRole }[]>([]);

  if (!currentUser || !hasPermission(currentUser.role, "Gerenciar usuários (convidar, editar, desativar)")) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Acesso Negado</h3>
          <p className="text-muted-foreground">Você não tem permissão para gerenciar usuários.</p>
        </div>
      </div>
    );
  }

  const filteredUsers = safeUsers.filter(user => {
    const n = (user?.name || '').toLowerCase();
    const e = (user?.email || '').toLowerCase();
    const q = (searchTerm || '').toLowerCase();
    const matchText = n.includes(q) || e.includes(q);
    const matchRole = filterRole === 'all' ? true : user.role === filterRole;
    const matchStatus = filterStatus === 'all' ? true : ((user as any).status || 'active') === filterStatus;
    return matchText && matchRole && matchStatus;
  });
  const sortedUsers = [...filteredUsers].sort((a: any, b: any) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmp = (av?: any, bv?: any) => {
      const aStr = (av ?? '').toString().toLowerCase();
      const bStr = (bv ?? '').toString().toLowerCase();
      return aStr.localeCompare(bStr) * dir;
    };
    if (sortBy === 'name') return cmp(a.name, b.name);
    if (sortBy === 'email') return cmp(a.email, b.email);
    if (sortBy === 'role') return cmp(a.role, b.role);
    if (sortBy === 'status') return cmp(a.status, b.status);
    if (sortBy === 'last_login') {
      const at = a.last_login ? new Date(a.last_login).getTime() : 0;
      const bt = b.last_login ? new Date(b.last_login).getTime() : 0;
      return (at - bt) * dir;
    }
    return 0;
  });
  const total = sortedUsers.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sliceStart = (page - 1) * pageSize;
  const paginatedUsers = sortedUsers.slice(sliceStart, sliceStart + pageSize);

  // Carrega usuários (profiles) da organização atual
  useEffect(() => {
    // Carrega preferência de page size
    try {
      const raw = localStorage.getItem('users_page_size');
      const val = raw ? parseInt(raw) : NaN;
      if (!Number.isNaN(val) && [10,25,50,100].includes(val)) {
        setPageSize(val as any);
      }
    } catch {}

    const loadUsers = async () => {
      if (!organization?.id) return;
      // Tenta buscar via view org_profiles filtrando por organization_id; se a view não tiver a coluna, cai no fallback direto na tabela profiles
      let data: any[] | null = null;
      let error: any = null;
      try {
        // View org_profiles com filtro explícito por organização (se a coluna existir na view)
        const res = await supabase
          .from('org_profiles')
          .select('id, email, name, role, organization_id')
          .eq('organization_id', organization.id)
          .order('name', { ascending: true } as any);
        if (res.error && /column .*organization_id.* does not exist/i.test(res.error.message)) {
          throw Object.assign(new Error('org_profiles.sem_coluna_org'), { code: 'NO_ORG_COL' });
        }
        data = res.data as any[] | null;
        error = res.error;
      } catch (e: any) {
        // Fallback: consulta direta na tabela profiles com filtro por organization_id
        try {
          const res2 = await supabase
            .from('profiles')
            .select('id, email, name, role, status, organization_id')
            .eq('organization_id', organization.id)
            .order('email', { ascending: true } as any);
          data = res2.data as any[] | null;
          error = res2.error;
        } catch (e2: any) {
          error = e2;
        }
      }
      if (error) {
        toast({ title: 'Erro ao carregar usuários', description: error.message, variant: 'destructive' });
        return;
      }

      const mapped = (data || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name || u.email?.split('@')[0] || 'Usuário',
        role: u.role,
        status: (u as any).status || 'active',
        created_at: (u as any).created_at || undefined,
        last_login: (u as any).last_login || undefined,
        organization_id: u.organization_id || organization.id,
      }));
      setUsers(mapped);
    };
    const loadInvites = async () => {
      if (!organization?.id) return;
      const { data, error } = await supabase
        .from('organization_invited_admins')
        .select('id, email, role')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setInvites(data as any);
      }
    };
    // limpa cache da org anterior para não mostrar usuários errados enquanto carrega
    setUsers([]);
    loadUsers();
    loadInvites();
  }, [organization?.id, setUsers, toast]);

  // Persiste page size
  useEffect(() => {
    try { localStorage.setItem('users_page_size', String(pageSize)); } catch {}
  }, [pageSize]);
  // Persiste densidade
  useEffect(() => {
    try { localStorage.setItem('users_density', density); } catch {}
  }, [density]);

  const exportCsv = () => {
    const header = ['id','name','email','role','status'];
    const rows = filteredUsers.map(u => [u.id, JSON.stringify(u.name || ''), JSON.stringify(u.email || ''), u.role, (u as any).status || 'active']);
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usuarios.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !organization?.id) return;
    try {
      // Cria convite na tabela dedicada (consumido no primeiro login)
      const { error: invErr } = await supabase
        .from('organization_invited_admins')
        .insert({ organization_id: organization.id, email: inviteEmail.toLowerCase().trim(), role: inviteRole });
      if (invErr) throw invErr;

      // Opcionalmente, já envia o link mágico
      const { error: mailErr } = await requestLogin(inviteEmail);
      if (mailErr) {
        toast({ title: 'Convite criado, mas erro ao enviar e-mail', description: mailErr.message, variant: 'destructive' });
      } else {
        toast({ title: 'Convite enviado!', description: `Enviamos um link de acesso para ${inviteEmail}.` });
      }

      // Feedback e reset
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("member");
    } catch (e: any) {
      toast({ title: 'Erro ao convidar usuário', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const handleChangeUserStatus = async (userId: string, newStatus: 'active' | 'inactive') => {
    // Tenta persistir no banco; se RLS bloquear, mantém UI atual
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userId);
    if (error) {
      toast({ title: 'Não foi possível alterar o status', description: error.message, variant: 'destructive' });
      return;
    }
    setUsers(users.map(user => user.id === userId ? { ...user, status: newStatus } : user));
    toast({ title: 'Status atualizado', description: `Status do usuário foi alterado para ${newStatus === 'active' ? 'ativo' : 'inativo'}` });
  };

  // Alterar papel do usuário (role)
  const handleChangeUserRole = async (userId: string, newRole: UserRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    if (error) {
      toast({ title: 'Não foi possível alterar o papel', description: error.message, variant: 'destructive' });
      return;
    }
    setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    toast({ title: 'Papel atualizado', description: `Novo papel: ${getRoleLabel(newRole)}` });
  };

  // Reenviar convite
  const handleResendInvite = async (email: string) => {
    const { error } = await requestLogin(email);
    if (error) {
      toast({ title: 'Erro ao reenviar convite', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Convite reenviado', description: `Reenviamos o link para ${email}` });
    }
  };

  // Remover convite pendente
  const handleRemoveInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from('organization_invited_admins')
      .delete()
      .eq('id', inviteId);
    if (error) {
      toast({ title: 'Erro ao remover convite', description: error.message, variant: 'destructive' });
      return;
    }
    setInvites(prev => prev.filter(i => i.id !== inviteId));
    toast({ title: 'Convite removido' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      case 'inactive': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'pending': return 'Pendente';
      case 'inactive': return 'Inativo';
      default: return status;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in w-full px-4 md:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
            {organization?.name && (
              <Badge variant={supportMode ? 'secondary' : 'outline'}>
                {supportMode ? 'Suporte' : 'Org'}: {organization.name}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Gerencie os usuários da sua organização e suas permissões
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={density === 'normal' ? 'default' : 'outline'} size="sm" onClick={() => setDensity('normal')} title="Densidade normal">Normal</Button>
          <Button variant={density === 'compact' ? 'default' : 'outline'} size="sm" onClick={() => setDensity('compact')} title="Densidade compacta">Compacto</Button>
          <Button variant="outline" size="sm" onClick={exportCsv} title="Exportar CSV dos usuários filtrados">Exportar CSV</Button>
        </div>
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:bg-primary-hover shadow-primary">
              <UserPlus className="w-4 h-4 mr-2" />
              Convidar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Novo Usuário</DialogTitle>
              <DialogDescription>
                Envie um convite por e-mail para um novo usuário se juntar à organização
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">E-mail</label>
                <Input
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Papel</label>
                <Select value={inviteRole} onValueChange={(value: UserRole) => setInviteRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">
                      <span className="flex items-center gap-2">
                        👤 Membro
                      </span>
                    </SelectItem>
                    <SelectItem value="bot_manager">
                      <span className="flex items-center gap-2">
                        🤖 Especialista em IA
                      </span>
                    </SelectItem>
                    {(currentUser.role === 'owner' || currentUser.role === 'admin') && (
                      <SelectItem value="admin">
                        <span className="flex items-center gap-2">
                          🛡️ Administrador
                        </span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleInviteUser} className="bg-gradient-primary">
                  Enviar Convite
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeUsers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {safeUsers.filter(u => u.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {safeUsers.filter(u => u.status === 'pending').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {safeUsers.filter(u => u.role === 'admin' || u.role === 'owner').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Papel</Label>
            <Select value={filterRole} onValueChange={(v: any) => { setFilterRole(v); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="bot_manager">Especialista em IA</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={filterStatus} onValueChange={(v: any) => { setFilterStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Ordenar</Label>
            <Select value={sortBy} onValueChange={(v: any) => { setSortBy(v); setPage(1); }}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="role">Papel</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="last_login">Último Login</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortDir} onValueChange={(v: any) => { setSortDir(v); setPage(1); }}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Direção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascendente</SelectItem>
                <SelectItem value="desc">Descendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários da Organização</CardTitle>
          <CardDescription>
            Lista de todos os usuários e seus papéis na organização
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Login</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((user) => (
                <TableRow key={user.id} className={density === 'compact' ? 'text-sm' : ''}>
                  <TableCell className={density === 'compact' ? 'py-2' : ''}>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className={`flex items-center gap-2 ${density === 'compact' ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                        <span>{user.email}</span>
                        {user.role === 'owner' && (
                          <Badge variant="secondary" className="ml-1">⭐ Owner (global)</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={density === 'compact' ? 'py-2' : ''}>
                    {(currentUser.role === 'owner' || currentUser.role === 'admin') ? (
                      <Select value={user.role} onValueChange={(val: UserRole) => handleChangeUserRole(user.id, val)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">👤 Membro</SelectItem>
                          <SelectItem value="bot_manager">🤖 Especialista em IA</SelectItem>
                          <SelectItem value="admin">🛡️ Administrador</SelectItem>
                          {currentUser.role === 'owner' && (
                            <SelectItem value="owner">⭐ Owner</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <span>{getRoleIcon(user.role)}</span>
                        {getRoleLabel(user.role)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={density === 'compact' ? 'py-2' : ''}>
                    <Badge className={getStatusColor(user.status)}>
                      {getStatusLabel(user.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-muted-foreground ${density === 'compact' ? 'text-xs py-2' : 'text-sm'}`}>
                    {user.last_login || 'Nunca'}
                  </TableCell>
                  <TableCell className={density === 'compact' ? 'py-2' : ''}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {user.status === 'active' ? (
                          <DropdownMenuItem
                            onClick={() => handleChangeUserStatus(user.id, 'inactive')}
                          >
                            Desativar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleChangeUserStatus(user.id, 'active')}
                          >
                            Ativar
                          </DropdownMenuItem>
                        )}
                        {user.status === 'pending' && (
                          <DropdownMenuItem onClick={() => handleResendInvite(user.email)}>
                            <Mail className="w-4 h-4 mr-2" />
                            Reenviar Convite
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* Pagination */}
          <div className="flex items-center justify-between pt-3">
            <div className="text-sm text-muted-foreground">
              {total === 0 ? 'Nenhum usuário' : (
                <>Mostrando {sliceStart + 1}–{sliceStart + paginatedUsers.length} de {total}</>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v: any) => { setPageSize(parseInt(v) || 25); setPage(1); }}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / pág</SelectItem>
                  <SelectItem value="25">25 / pág</SelectItem>
                  <SelectItem value="50">50 / pág</SelectItem>
                  <SelectItem value="100">100 / pág</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                Anterior
              </Button>
              <div className="text-xs text-muted-foreground">
                Página {page} de {totalPages}
              </div>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Convites Pendentes */}
      <Card>
        <CardHeader>
          <CardTitle>Convites Pendentes</CardTitle>
          <CardDescription>E-mails convidados que ainda não fizeram login</CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>
          ) : (
            <div className="space-y-2">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between border rounded-md p-2">
                  <div className="text-sm">
                    <span className="font-medium">{inv.email}</span>
                    <Badge variant="secondary" className="ml-2">{getRoleLabel(inv.role)}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleResendInvite(inv.email)}>
                      <Send className="w-4 h-4 mr-1" /> Reenviar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleRemoveInvite(inv.id)}>
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersPage;