import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { ArrowLeft, Users, UserPlus, Search, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { hasPermission } from '@/lib/permissions';

interface GroupRow { id: string; organization_id: string; name: string; description?: string | null; is_default?: boolean }
interface ProfileRow { id: string; name: string | null; email: string | null; role?: string | null }
interface MemberRow { id?: string; user_id: string; group_id: string; role?: string | null; created_at: string }

export default function GroupMembersPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { organization, currentUser } = useApp();

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [loading, setLoading] = useState(false);

  // Busca paginada de usuários da organização
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<ProfileRow[]>([]);

  // Membros do grupo
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const memberIds = useMemo(() => new Set(members.map(m => m.user_id)), [members]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, ProfileRow>>({});
  const adminCount = useMemo(() => members.filter(m => (m.role as any) === 'admin').length, [members]);
  // Ordenação e paginação da lista "Membros atuais" (client-side)
  const [membersSort, setMembersSort] = useState<'name_asc'|'name_desc'|'email_asc'|'email_desc'|'joined_desc'|'joined_asc'>('joined_desc');
  const [membersPage, setMembersPage] = useState(1);
  const [membersPageSize, setMembersPageSize] = useState(50);
  const [membersExpanded, setMembersExpanded] = useState(true);
  const sortedMembers = useMemo(() => {
    const arr = [...members];
    const getName = (uid: string) => (memberProfiles[uid]?.name || '').toLowerCase();
    const getEmail = (uid: string) => (memberProfiles[uid]?.email || '').toLowerCase();
    switch (membersSort) {
      case 'name_asc':
        arr.sort((a,b) => getName(a.user_id).localeCompare(getName(b.user_id)) || getEmail(a.user_id).localeCompare(getEmail(b.user_id)));
        break;
      case 'name_desc':
        arr.sort((a,b) => getName(b.user_id).localeCompare(getName(a.user_id)) || getEmail(b.user_id).localeCompare(getEmail(a.user_id)));
        break;
      case 'email_asc':
        arr.sort((a,b) => getEmail(a.user_id).localeCompare(getEmail(b.user_id)));
        break;
      case 'email_desc':
        arr.sort((a,b) => getEmail(b.user_id).localeCompare(getEmail(a.user_id)));
        break;
      case 'joined_asc':
        arr.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'joined_desc':
      default:
        arr.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return arr;
  }, [members, memberProfiles, membersSort]);
  const membersTotalPages = Math.max(1, Math.ceil(sortedMembers.length / membersPageSize));
  const membersSliceStart = (membersPage - 1) * membersPageSize;
  const membersSlice = useMemo(() => sortedMembers.slice(membersSliceStart, membersSliceStart + membersPageSize), [sortedMembers, membersPage, membersPageSize]);

  const [addEmail, setAddEmail] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);

  // Permissões
  if (!currentUser || !hasPermission(currentUser.role, 'Gerenciar grupos de usuários')) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>Você não tem permissão para gerenciar grupos.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Carrega grupo e membros
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!organization?.id || !id) return;
        const { data: g } = await supabase.from('user_groups').select('id, organization_id, name, description, is_default').eq('id', id).single();
        if (!ignore) setGroup(g as GroupRow);
        setMembersLoading(true);
        const { data: mem } = await supabase.rpc('list_group_members', { p_group: id });
        if (!ignore) {
          setMembers((mem || []) as MemberRow[]);
        }
        // Carrega perfis dos membros para mostrar nome/email
        const uids = Array.from(new Set(((mem || []) as any[]).map((m: any) => m.user_id))).filter(Boolean);
        if (uids.length) {
          const { data: profs } = await supabase.from('profiles').select('id, name, email').in('id', uids);
          if (!ignore) {
            const map: Record<string, ProfileRow> = {};
            (profs || []).forEach((p: any) => { map[p.id] = p; });
            setMemberProfiles(map);
          }
        } else {
          if (!ignore) setMemberProfiles({});
        }
        if (!ignore) {
          setMembersLoading(false);
        }
      } catch {}
    })();
    return () => { ignore = true; };
  }, [organization?.id, id]);

  // Lê preferência expandido/recolhido do localStorage por grupo
  useEffect(() => {
    try {
      if (!id) return;
      const key = `gm.membersExpanded.${id}`;
      const raw = localStorage.getItem(key);
      if (raw === 'true') setMembersExpanded(true);
      else if (raw === 'false') setMembersExpanded(false);
      // Ordenação
      const sortKey = `gm.membersSort.${id}`;
      const sortRaw = localStorage.getItem(sortKey) as any;
      if (sortRaw && ['name_asc','name_desc','email_asc','email_desc','joined_desc','joined_asc'].includes(sortRaw)) {
        setMembersSort(sortRaw);
      }
      // Page size
      const sizeKey = `gm.membersPageSize.${id}`;
      const sizeRaw = localStorage.getItem(sizeKey);
      const sizeVal = sizeRaw ? parseInt(sizeRaw) : NaN;
      if (!Number.isNaN(sizeVal) && [25,50,100].includes(sizeVal)) {
        setMembersPageSize(sizeVal as any);
      }
    } catch {}
  }, [id]);

  // Salva preferência quando alterar
  useEffect(() => {
    try {
      if (!id) return;
      const key = `gm.membersExpanded.${id}`;
      localStorage.setItem(key, membersExpanded ? 'true' : 'false');
    } catch {}
  }, [id, membersExpanded]);

  // Salva ordenação e page size
  useEffect(() => {
    try {
      if (!id) return;
      localStorage.setItem(`gm.membersSort.${id}`, membersSort);
    } catch {}
  }, [id, membersSort]);
  useEffect(() => {
    try {
      if (!id) return;
      localStorage.setItem(`gm.membersPageSize.${id}`, String(membersPageSize));
    } catch {}
  }, [id, membersPageSize]);

  // Helper para recarregar membros e perfis do DB
  const reloadMembers = async () => {
    if (!id) return;
    setMembersLoading(true);
    const { data: mem } = await supabase.rpc('list_group_members', { p_group: id });
    setMembers((mem || []) as MemberRow[]);
    const uids = Array.from(new Set(((mem || []) as any[]).map((m: any) => m.user_id))).filter(Boolean);
    if (uids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, name, email').in('id', uids);
      const map: Record<string, ProfileRow> = {}; (profs || []).forEach((p: any) => { map[p.id] = p; });
      setMemberProfiles(map);
    } else { setMemberProfiles({}); }
    setMembersLoading(false);
  };

  // Carrega usuários paginados (via RPC)
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!organization?.id) return;
        setLoading(true);
        const offset = (page - 1) * pageSize;
        // total via RPC
        const { data: totalCount } = await supabase.rpc('count_org_users', { p_org: organization.id, p_q: debouncedQ || null });
        // página via RPC
        const { data: rows } = await supabase.rpc('search_org_users', { p_org: organization.id, p_q: debouncedQ || null, p_limit: pageSize, p_offset: offset });
        if (!ignore) {
          setUsers((rows || []) as ProfileRow[]);
          setTotal(Number(totalCount || 0));
        }
      } catch (e: any) {
        if (import.meta.env.DEV) console.debug('[GroupMembersPage] Falha ao buscar usuários', e?.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [organization?.id, debouncedQ, page, pageSize]);

  const addByEmail = async () => {
    try {
      if (!id || !organization?.id) return;
      if (!addEmail.trim()) { toast.error('Informe um e-mail'); return; }
      const { data: p } = await supabase.from('profiles').select('id, email').eq('email', addEmail.trim()).eq('organization_id', organization.id).single();
      if (!p?.id) { toast.error('Usuário não encontrado nesta organização'); return; }
      const { error } = await supabase
        .from('group_members')
        .upsert({ group_id: id, user_id: p.id, created_by: currentUser!.id, role: 'member' } as any, { onConflict: 'group_id,user_id' } as any);
      if (error) throw error;
      await reloadMembers();
      setAddEmail('');
      toast.success('Usuário adicionado ao grupo');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao adicionar usuário (verifique permissões e se já é membro)');
    }
  };

  const formatRpcError = (msg?: string) => {
    const m = (msg || '').toLowerCase();
    if (m.includes('cannot remove the last admin') || m.includes('cannot demote the last admin')) {
      return 'Não é possível remover/rebaixar o último admin do grupo.';
    }
    if (m.includes('only owner can remove an admin')) {
      return 'Apenas o owner pode remover um admin do grupo.';
    }
    if (m.includes('only owner can demote an admin')) {
      return 'Apenas o owner pode rebaixar um admin do grupo.';
    }
    if (m.includes('not authorized')) {
      return 'Você não tem autorização para executar esta ação.';
    }
    return msg || 'Operação não permitida.';
  };

  const removeMember = async (userId: string) => {
    try {
      if (!id) return;
      const { error } = await supabase.rpc('remove_group_member', { p_group: id, p_user: userId });
      if (error) throw error;
      await reloadMembers();
      toast.success('Membro removido');
    } catch (e: any) {
      toast.error(formatRpcError(e?.message));
    }
  };

  const updateMemberRole = async (userId: string, newRole: 'member' | 'admin') => {
    try {
      if (!id) return;
      const current = members.find(m => m.user_id === userId);
      const currentRole = (current?.role || 'member') as 'member' | 'admin';
      // Bloqueio: admin não pode rebaixar outro admin
      if (currentUser.role === 'admin' && currentRole === 'admin' && newRole === 'member') {
        toast.error('Apenas o owner pode rebaixar outro admin do grupo.');
        return;
      }
      if (newRole === 'admin') {
        const proceed = window.confirm('Promover este membro para administrador do grupo?\n\nAdministradores podem gerenciar outros membros deste grupo.');
        if (!proceed) return;
      }
      if (currentRole === 'admin' && newRole === 'member') {
        const proceed = window.confirm('Rebaixar este administrador para membro?\n\nEle perderá poderes de gerenciamento neste grupo.');
        if (!proceed) return;
      }
      const { error } = await supabase.rpc('set_group_member_role', { p_group: id, p_user: userId, p_role: newRole });
      if (error) throw error;
      await reloadMembers();
      toast.success('Papel do membro atualizado');
    } catch (e: any) {
      toast.error(formatRpcError(e?.message));
    }
  };

  const addAllFiltered = async () => {
    try {
      if (!organization?.id || !id) return;
      if (!window.confirm('Adicionar TODOS os usuários do filtro atual a este grupo?')) return;
      setBulkWorking(true);
      const { data: added, error } = await supabase.rpc('add_group_members_by_filter', { p_org: organization.id, p_group: id, p_q: debouncedQ || null });
      if (error) throw error;
      // Reload membros
      const { data: mem } = await supabase.from('group_members').select('id, user_id, group_id, created_at').eq('group_id', id).order('created_at', { ascending: false } as any);
      setMembers((mem || []) as MemberRow[]);
      // Recarrega perfis dos membros
      const uids = Array.from(new Set((mem || []).map((m: any) => m.user_id))).filter(Boolean);
      if (uids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, name, email').in('id', uids);
        const map: Record<string, ProfileRow> = {}; (profs || []).forEach((p: any) => { map[p.id] = p; });
        setMemberProfiles(map);
      } else { setMemberProfiles({}); }
      toast.success(`Adicionados ${Number(added || 0)} usuário(s) do filtro`);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao adicionar em massa');
    } finally {
      setBulkWorking(false);
    }
  };

  const removeAllFiltered = async () => {
    try {
      if (!organization?.id || !id) return;
      if (!window.confirm('Remover TODOS os usuários do filtro atual deste grupo?')) return;
      setBulkWorking(true);
      const { data: removed, error } = await supabase.rpc('remove_group_members_by_filter', { p_org: organization.id, p_group: id, p_q: debouncedQ || null });
      if (error) throw error;
      const { data: mem } = await supabase.from('group_members').select('id, user_id, group_id, created_at').eq('group_id', id).order('created_at', { ascending: false } as any);
      setMembers((mem || []) as MemberRow[]);
      // Atualiza cache de perfis
      const uids = Array.from(new Set((mem || []).map((m: any) => m.user_id))).filter(Boolean);
      if (uids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, name, email').in('id', uids);
        const map: Record<string, ProfileRow> = {}; (profs || []).forEach((p: any) => { map[p.id] = p; });
        setMemberProfiles(map);
      } else { setMemberProfiles({}); }
      toast.success(`Removidos ${Number(removed || 0)} usuário(s) do filtro`);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao remover em massa');
    } finally {
      setBulkWorking(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="w-full px-4 md:px-8 py-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <h1 className="text-2xl font-semibold">Membros do Grupo</h1>
          </div>
        </div>
        {group && (
          <div className="text-right">
            <div className="font-medium">{group.name}</div>
            <div className="text-xs text-muted-foreground">{group.description || '—'}</div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adicionar Membros</CardTitle>
          <CardDescription>Busque usuários por nome ou e-mail e adicione-os ao grupo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="grid gap-2 md:col-span-2">
              <Label>Buscar</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input className="pl-8" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Nome ou e-mail" />
                </div>
                <Select value={String(pageSize)} onValueChange={(v: any) => { setPage(1); setPageSize(parseInt(v) || 50); }}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tamanho" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 / pág</SelectItem>
                    <SelectItem value="50">50 / pág</SelectItem>
                    <SelectItem value="100">100 / pág</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Adicionar por e-mail</Label>
              <div className="flex items-center gap-2">
                <Input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="usuario@empresa.com" />
                <Button onClick={addByEmail}><UserPlus className="h-4 w-4 mr-1" /> Adicionar</Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {loading ? 'Carregando…' : `${total} usuário(s) encontrado(s)`}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={bulkWorking || loading} onClick={addAllFiltered}>Adicionar todos do filtro</Button>
              <Button variant="outline" size="sm" disabled={bulkWorking || loading} onClick={removeAllFiltered}>Remover todos do filtro</Button>
            </div>
          </div>

          <div className="border rounded-md divide-y">
            {loading && (
              <>
                {[...Array(5)].map((_, i) => (
                  <div key={`usr-sk-${i}`} className="p-3">
                    <div className="h-4 bg-muted rounded w-1/4 animate-pulse mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/6 animate-pulse"></div>
                  </div>
                ))}
              </>
            )}
            {!loading && users.map(u => (
              <div key={u.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{u.name || u.email || u.id}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {memberIds.has(u.id) ? (
                    <>
                      <Badge variant="outline">Membro</Badge>
                      <Button variant="outline" size="sm" onClick={() => removeMember(u.id)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Remover
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={async () => {
                      try {
                        if (!id) return;
                        const { error } = await supabase
                          .from('group_members')
                          .upsert({ group_id: id, user_id: u.id, created_by: currentUser!.id, role: 'member' } as any, { onConflict: 'group_id,user_id' } as any);
                        if (error) throw error;
                        await reloadMembers();
                        toast.success('Usuário adicionado');
                      } catch (e: any) { toast.error(e?.message || 'Falha ao adicionar (verifique permissões e se já é membro)'); }
                    }}>Adicionar</Button>
                  )}
                </div>
              </div>
            ))}
            {!loading && !users.length && (
              <div className="p-3 text-sm text-muted-foreground">Nenhum usuário encontrado para o filtro.</div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
            <div className="text-sm">Página {page} de {totalPages}</div>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Próxima</Button>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="flex items-center gap-1">
                <Users className={`h-4 w-4 transition-colors ${membersExpanded ? '' : 'text-muted-foreground/70'}`} />
                Membros atuais
              </Label>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span>Ordenar por</span>
                  <select className="border rounded px-1 py-0.5" value={membersSort} onChange={(e) => { setMembersPage(1); setMembersSort(e.target.value as any); }}>
                    <option value="joined_desc">Entrada (recente)</option>
                    <option value="joined_asc">Entrada (antiga)</option>
                    <option value="name_asc">Nome (A-Z)</option>
                    <option value="name_desc">Nome (Z-A)</option>
                    <option value="email_asc">E-mail (A-Z)</option>
                    <option value="email_desc">E-mail (Z-A)</option>
                  </select>
                </div>
                <span>{members.length} membro(s) • {adminCount} admin(s)</span>
                <Button variant="outline" size="sm" onClick={reloadMembers}>Recarregar</Button>
                <Button variant="outline" size="sm" onClick={() => setMembersExpanded(v => !v)}>
                  {membersExpanded ? (<><ChevronUp className="h-4 w-4 mr-1"/> Recolher</>) : (<><ChevronDown className="h-4 w-4 mr-1"/> Expandir</>)}
                </Button>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground/90 -mt-1 mb-1">
              Observações: Apenas owners podem rebaixar/remover admins. O último admin do grupo não pode ser removido ou rebaixado.
            </div>
            {membersExpanded && (
            <div className="border rounded-md divide-y">
              {membersLoading && (
                <>
                  {[...Array(3)].map((_, i) => (
                    <div key={`sk-${i}`} className="p-3">
                      <div className="h-4 bg-muted rounded w-1/3 animate-pulse mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/5 animate-pulse"></div>
                    </div>
                  ))}
                </>
              )}
              {membersSlice.map(m => (
                <div key={m.user_id} className="p-2 text-xs flex items-center justify-between gap-3">
                  <div className="text-muted-foreground flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            {memberProfiles[m.user_id]?.name || memberProfiles[m.user_id]?.email || m.user_id}
                            {memberProfiles[m.user_id]?.email && memberProfiles[m.user_id]?.name && (
                              <span className="ml-1 text-[10px] text-muted-foreground">({memberProfiles[m.user_id]?.email})</span>
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span>Entrou em {new Date(m.created_at).toLocaleString('pt-BR')}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {m.role && <Badge variant="outline">{m.role}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {['owner','admin'].includes(currentUser.role) && (
                      <select
                        className="border rounded px-1 py-0.5 bg-background"
                        value={(m.role as any) || 'member'}
                        onChange={(e) => updateMemberRole(m.user_id, e.target.value as any)}
                        disabled={currentUser.role === 'admin' && (m.role as any) === 'admin'}
                        title={currentUser.role === 'admin' && (m.role as any) === 'admin' ? 'Apenas o owner pode rebaixar outro admin' : undefined}
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMember(m.user_id)}
                      title={currentUser.role === 'admin' && (m.role as any) === 'admin' ? 'Apenas o owner pode remover um admin' : 'Remover membro'}
                      disabled={currentUser.role === 'admin' && (m.role as any) === 'admin'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {!membersLoading && !members.length && (
                <div className="p-3 text-sm text-muted-foreground">Nenhum membro ainda.</div>
              )}
            </div>
            )}
            {!membersLoading && membersExpanded && members.length > 0 && (
              <div className="flex items-center justify-end gap-2 pt-3 text-xs">
                <div className="flex items-center gap-2">
                  <span>Mostrar</span>
                  <select className="border rounded px-1 py-0.5" value={membersPageSize} onChange={(e) => { setMembersPage(1); setMembersPageSize(parseInt(e.target.value) || 50); }}>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>por página</span>
                </div>
                <Button variant="outline" size="sm" disabled={membersPage <= 1} onClick={() => setMembersPage(p => Math.max(1, p - 1))}>Anterior</Button>
                <div>Página {membersPage} de {membersTotalPages}</div>
                <Button variant="outline" size="sm" disabled={membersPage >= membersTotalPages} onClick={() => setMembersPage(p => Math.min(membersTotalPages, p + 1))}>Próxima</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
