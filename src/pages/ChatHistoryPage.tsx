import React, { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, MessageSquare, Search, Filter, Download, Trash2, Share, ThumbsUp, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '@/lib/permissions';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type RpcRow = {
  day: string; // date
  agent_id: string;
  agent_name: string;
  message_count: number;
  first_time: string;
  last_time: string;
  last_message: string;
  status: 'active' | 'completed';
};

export default function ChatHistoryPage() {
  const navigate = useNavigate();
  const { currentUser, organization, agents } = useApp();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all'|'active'|'completed'>('all');
  const [rows, setRows] = useState<RpcRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>(''); // YYYY-MM-DD
  const [toDate, setToDate] = useState<string>(''); // YYYY-MM-DD
  const [limit, setLimit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [stats, setStats] = useState<{ total_count: number; active_count: number; completed_count: number; avg_duration_seconds: number | null }>({ total_count: 0, active_count: 0, completed_count: 0, avg_duration_seconds: null });
  const [feedback, setFeedback] = useState<{ likes_count: number; total_count: number; ratio: number }>({ likes_count: 0, total_count: 0, ratio: 0 });
  const [likedAgents, setLikedAgents] = useState<Set<string>>(new Set());
  const [likesCounts, setLikesCounts] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<'recent'|'messages'|'status'|'likes'>('recent');

  if (!currentUser || !hasPermission(currentUser.role, 'Ver histórico de conversas')) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar o histórico de conversas.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    const load = async () => {
      if (!organization?.id) return;
      setLoading(true);
      setError(null);
      try {
        const selectedAgentId = filterAgent === 'all' ? null : (agents.find(a => a.name === filterAgent)?.id || null);
        const { data, error } = await supabase.rpc('list_chat_history_by_day', {
          p_org: organization.id,
          p_from: fromDate ? fromDate : null,
          p_to: toDate ? toDate : null,
          p_agent: selectedAgentId,
          p_q: searchTerm || null,
          p_status: filterStatus === 'all' ? null : filterStatus,
          p_limit: limit,
          p_offset: offset,
        });
        if (error) throw error;
        setRows(Array.isArray(data) ? data as RpcRow[] : []);
        // busca contagem total
        const { data: cnt, error: errCnt } = await supabase.rpc('list_chat_history_by_day_count', {
          p_org: organization.id,
          p_from: fromDate ? fromDate : null,
          p_to: toDate ? toDate : null,
          p_agent: selectedAgentId,
          p_q: searchTerm || null,
          p_status: filterStatus === 'all' ? null : filterStatus,
        });
        if (!errCnt) setTotal(Number(cnt || 0));
        // busca estatísticas agregadas
        const { data: statRows, error: errStats } = await supabase.rpc('list_chat_history_stats', {
          p_org: organization.id,
          p_from: fromDate ? fromDate : null,
          p_to: toDate ? toDate : null,
          p_agent: selectedAgentId,
          p_q: searchTerm || null,
          p_status: filterStatus === 'all' ? null : filterStatus,
        });
        if (!errStats && Array.isArray(statRows) && statRows.length) {
          const s = statRows[0] as any;
          setStats({
            total_count: Number(s.total_count || 0),
            active_count: Number(s.active_count || 0),
            completed_count: Number(s.completed_count || 0),
            avg_duration_seconds: typeof s.avg_duration_seconds === 'number' ? s.avg_duration_seconds : (s.avg_duration_seconds ? Number(s.avg_duration_seconds) : null)
          });
        } else {
          setStats({ total_count: 0, active_count: 0, completed_count: 0, avg_duration_seconds: null });
        }
        // satisfação (feedback): taxa de curtidas no período e agente
        const { data: fbRows, error: errFb } = await supabase.rpc('agent_feedback_stats', {
          p_org: organization.id,
          p_from: fromDate ? fromDate : null,
          p_to: toDate ? toDate : null,
          p_agent: selectedAgentId,
        });
        if (!errFb && Array.isArray(fbRows) && fbRows.length) {
          const f = fbRows[0] as any;
          setFeedback({ likes_count: Number(f.likes_count || 0), total_count: Number(f.total_count || 0), ratio: Number(f.ratio || 0) });
        } else {
          setFeedback({ likes_count: 0, total_count: 0, ratio: 0 });
        }
      } catch (e: any) {
        setError(e?.message || 'Falha ao carregar histórico');
        setRows([]);
        setTotal(0);
        setStats({ total_count: 0, active_count: 0, completed_count: 0, avg_duration_seconds: null });
        setFeedback({ likes_count: 0, total_count: 0, ratio: 0 });
      } finally {
        setLoading(false);
      }
    };
    // Debounce simples para busca
    const id = setTimeout(load, 200);
    return () => clearTimeout(id);
  }, [organization?.id, searchTerm, filterStatus, fromDate, toDate, limit, offset, filterAgent]);

  // Carrega curtidas do usuário para os agentes presentes na página atual
  useEffect(() => {
    const loadLikes = async () => {
      try {
        if (!organization?.id || !currentUser?.id || rows.length === 0) {
          setLikedAgents(new Set());
          return;
        }
        const agentIds = Array.from(new Set(rows.map(r => r.agent_id)));
        const { data, error } = await supabase
          .from('agent_feedback')
          .select('agent_id, liked')
          .eq('user_id', currentUser.id)
          .in('agent_id', agentIds);
        if (error) throw error;
        const likedSet = new Set<string>();
        (data || []).forEach((row: any) => { if (row.liked) likedSet.add(row.agent_id); });
        setLikedAgents(likedSet);
      } catch {
        setLikedAgents(new Set());
      }
    };
    loadLikes();
  }, [organization?.id, currentUser?.id, rows.map(r => r.agent_id).join(',')]);

  // Carrega contagem de curtidas por agente (dentro do período) para os agentes da página
  useEffect(() => {
    const loadLikesCounts = async () => {
      try {
        if (!organization?.id || rows.length === 0) {
          setLikesCounts({});
          return;
        }
        const agentIds = Array.from(new Set(rows.map(r => r.agent_id)));
        // Busca as curtidas dentro do período nas IDs visíveis
        let q = supabase
          .from('agent_feedback')
          .select('agent_id, liked, created_at')
          .in('agent_id', agentIds)
          .eq('organization_id', organization.id);
        if (fromDate) q = q.gte('created_at', fromDate);
        if (toDate) q = q.lt('created_at', `${toDate}T23:59:59`);
        const { data, error } = await q;
        if (error) throw error;
        const map: Record<string, number> = {};
        (data || []).forEach((r: any) => {
          if (r.liked) map[r.agent_id] = (map[r.agent_id] || 0) + 1;
        });
        setLikesCounts(map);
      } catch {
        setLikesCounts({});
      }
    };
    loadLikesCounts();
  }, [organization?.id, rows.map(r => r.agent_id).join(','), fromDate, toDate]);

  const filteredHistory = rows
    .filter(r => filterAgent === 'all' || r.agent_name === filterAgent)
    .map<RpcRow>(r => r);

  // Ordenação cliente
  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (sortBy === 'messages') {
      return (b.message_count - a.message_count) || (new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
    }
    if (sortBy === 'status') {
      const rank = (s: string) => (s === 'active' ? 0 : 1);
      const sr = rank(a.status) - rank(b.status);
      if (sr !== 0) return sr;
      return new Date(b.last_time).getTime() - new Date(a.last_time).getTime();
    }
    if (sortBy === 'likes') {
      const la = likesCounts[a.agent_id] || 0;
      const lb = likesCounts[b.agent_id] || 0;
      if (lb !== la) return lb - la;
      return new Date(b.last_time).getTime() - new Date(a.last_time).getTime();
    }
    // recent (padrão): já vem ordenado pela RPC, mas reforçamos por last_time desc
    return new Date(b.last_time).getTime() - new Date(a.last_time).getTime();
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  // Formata duração média
  const formatAvg = (sec: number | null) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m`;
  };

  // Atalho de curtida/descurtida por agente na lista (fora do useEffect)
  const quickToggleLike = async (agentId: string) => {
    if (!organization?.id || !currentUser?.id) return;
    const willLike = !likedAgents.has(agentId);
    try {
      const payload = { organization_id: organization.id, agent_id: agentId, user_id: currentUser.id, liked: willLike } as any;
      const { error } = await supabase.from('agent_feedback').upsert(payload, { onConflict: 'agent_id,user_id' } as any);
      if (error) throw error;
      // Atualiza estado local
      setLikedAgents(prev => {
        const next = new Set(prev);
        if (willLike) next.add(agentId); else next.delete(agentId);
        return next;
      });
      toast({ title: willLike ? 'Curtido!' : 'Removido', description: willLike ? 'Curtida registrada.' : 'Sua curtida foi removida.' });
    } catch (e: any) {
      toast({ title: 'Não foi possível registrar o feedback', description: e?.message || 'Tente novamente mais tarde.', variant: 'destructive' });
    }
  };

  // Exportar mensagens detalhadas (JSON) respeitando filtros atuais
  const exportMessages = async () => {
    if (!organization?.id) return;
    try {
      const selectedAgentId = filterAgent === 'all' ? null : (agents.find(a => a.name === filterAgent)?.id || null);
      const agentIds = selectedAgentId ? [selectedAgentId] : Array.from(new Set(rows.map(r => r.agent_id)));
      if (agentIds.length === 0) {
        toast({ title: 'Nada para exportar', description: 'Nenhum agente encontrado com os filtros atuais.' });
        return;
      }
      let q = supabase.from('agent_messages')
        .select('id, agent_id, user_id, role, content, created_at')
        .in('agent_id', agentIds)
        .order('created_at', { ascending: true } as any);
      if (fromDate) q = q.gte('created_at', fromDate);
      if (toDate) q = q.lt('created_at', `${toDate}T23:59:59`);
      if (searchTerm) q = q.ilike('content', `%${searchTerm}%`);
      const { data, error } = await q;
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data || [], null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chat-messages.json';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportação concluída', description: `Exportamos ${(data || []).length} mensagens.` });
    } catch (e: any) {
      toast({ title: 'Falha na exportação', description: e?.message || 'Erro ao exportar mensagens', variant: 'destructive' });
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'completed': return 'Finalizado';
      default: return 'Desconhecido';
    }
  };

  // Realça o dia atual na listagem
  const isToday = (dayStr: string) => {
    try {
      const d = new Date(dayStr);
      const today = new Date();
      const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
      return ymd(d) === ymd(today);
    } catch { return false; }
  };

  // Exportação CSV/JSON respeitando filtros atuais
  const exportAll = async (fmt: 'csv'|'json') => {
    if (!organization?.id) return;
    try {
      const selectedAgentId = filterAgent === 'all' ? null : (agents.find(a => a.name === filterAgent)?.id || null);
      // Busca tudo respeitando filtros (usa total, com fallback)
      const { data, error } = await supabase.rpc('list_chat_history_by_day', {
        p_org: organization.id,
        p_from: fromDate ? fromDate : null,
        p_to: toDate ? toDate : null,
        p_agent: selectedAgentId,
        p_q: searchTerm || null,
        p_status: filterStatus === 'all' ? null : filterStatus,
        p_limit: Math.max(total || 1000, 1000),
        p_offset: 0,
      });
      if (error) throw error;
      const items = Array.isArray(data) ? (data as RpcRow[]) : [];
      if (fmt === 'json') {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chat-history.json';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const header = ['day','agent_id','agent_name','message_count','first_time','last_time','last_message','status'];
        const csv = [header.join(',')].concat(
          items.map(r => [
            r.day,
            r.agent_id,
            JSON.stringify(r.agent_name),
            String(r.message_count),
            new Date(r.first_time).toISOString(),
            new Date(r.last_time).toISOString(),
            JSON.stringify((r.last_message || '').replace(/\n/g,' ')),
            r.status
          ].join(','))
        ).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chat-history.csv';
        a.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: 'Exportação concluída', description: `Exportamos ${items.length} linhas (${fmt.toUpperCase()}).` });
    } catch (e: any) {
      toast({ title: 'Falha na exportação', description: e?.message || 'Erro ao exportar', variant: 'destructive' });
    }
  };

  return (
    <div className="w-full px-4 md:px-8 py-4 space-y-3 md:space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Histórico de Conversas</h1>
          <p className="text-muted-foreground">
            Gerencie e revise todas as conversas dos agentes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportAll('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => exportAll('json')}>
            <Filter className="h-4 w-4 mr-2" />
            Exportar JSON
          </Button>
          <Button variant="outline" onClick={exportMessages}>
            <Filter className="h-4 w-4 mr-2" />
            Exportar Mensagens (JSON)
          </Button>
          <div className="flex items-center gap-2 ml-2">
            <Label className="text-xs text-muted-foreground">Ordenar por</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="messages">Mensagens</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="likes">Curtidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Feedback de carregamento/erro */}
      {loading && (
        <div className="text-sm text-muted-foreground">Carregando histórico…</div>
      )}
      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {/* Estatísticas (placeholder) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Conversas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_count}</div>
            <p className="text-xs text-muted-foreground">No período filtrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
            <MessageSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_count}</div>
            <p className="text-xs text-muted-foreground">Com atividade recente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAvg(stats.avg_duration_seconds)}</div>
            <p className="text-xs text-muted-foreground">Duração média por conversa</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Satisfação</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1 rounded hover:bg-accent" aria-label="Como calculamos a satisfação?">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Baseado na taxa de curtidas por agente no período filtrado.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <MessageSquare className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(Math.round((feedback.ratio * 5) * 10) / 10).toFixed(1)}/5</div>
            <p className="text-xs text-muted-foreground">{Math.round(feedback.ratio * 100)}% curtiram ({feedback.likes_count}/{feedback.total_count})</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:grid md:grid-cols-5 gap-4 items-end">
            <div className="flex-1">
              <Label className="block text-xs text-muted-foreground mb-1">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por agente ou conteúdo…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="block text-xs text-muted-foreground mb-1">De</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <Label className="block text-xs text-muted-foreground mb-1">Até</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div>
              <Label className="block text-xs text-muted-foreground mb-1">Agente</Label>
              <Select value={filterAgent} onValueChange={setFilterAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os agentes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os agentes</SelectItem>
                  {[...new Set(rows.map(r => r.agent_name))].map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block text-xs text-muted-foreground mb-1">Status</Label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="completed">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setFromDate('');
                  setToDate('');
                  setFilterAgent('all');
                  setFilterStatus('all');
                  setOffset(0);
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Conversas (agregado por dia) */}
      <div className="space-y-4">
        {sortedHistory.map((row) => (
          <Card key={`${row.day}-${row.agent_id}`} className={`hover:shadow-md transition-shadow ${isToday(row.day) ? 'ring-2 ring-primary/40' : ''}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{row.agent_name}</h3>
                    <Badge className={getStatusColor(row.status)}>
                      {getStatusLabel(row.status)}
                    </Badge>
                    {isToday(row.day) && (
                      <Badge variant="secondary">Hoje</Badge>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={likedAgents.has(row.agent_id) ? 'outline' : 'secondary'}
                            className={likedAgents.has(row.agent_id) ? 'border-primary text-primary cursor-pointer' : 'cursor-pointer'}
                            onClick={() => quickToggleLike(row.agent_id)}
                            title={likedAgents.has(row.agent_id) ? 'Descurtir' : 'Curtir'}
                          >
                            <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                            {likedAgents.has(row.agent_id) ? 'Curtido' : 'Curtir'}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {likedAgents.has(row.agent_id) ? 'Clique para descurtir este agente' : 'Clique para curtir este agente'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Dia: {new Date(row.day).toLocaleDateString('pt-BR')} • {row.message_count} mensagens
                  </p>
                  <p className="text-sm">
                    Início: {new Date(row.first_time).toLocaleString('pt-BR')}
                    {row.status === 'completed' && (
                      <span> • Fim: {new Date(row.last_time).toLocaleString('pt-BR')}</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    "{row.last_message}"
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // tenta usar slug do agente se disponível
                      const agent = agents.find(a => a.id === row.agent_id);
                      const slugOrId = agent?.slug || row.agent_id;
                      const params = new URLSearchParams();
                      if (row.first_time) params.set('from', new Date(row.first_time).toISOString());
                      if (row.last_time) params.set('to', new Date(row.last_time).toISOString());
                      params.set('source', 'history');
                      // Monta return com os filtros atuais da página de histórico
                      const ret = new URLSearchParams();
                      if (searchTerm) ret.set('q', searchTerm);
                      if (fromDate) ret.set('from', fromDate);
                      if (toDate) ret.set('to', toDate);
                      if (filterAgent && filterAgent !== 'all') ret.set('agent', filterAgent);
                      if (filterStatus && filterStatus !== 'all') ret.set('status', filterStatus);
                      ret.set('limit', String(limit));
                      ret.set('offset', String(offset));
                      const returnUrl = `/chat/history?${ret.toString()}`;
                      params.set('return', encodeURIComponent(returnUrl));
                      navigate(`/agents/chat/${slugOrId}?${params.toString()}`);
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Ver Conversa
                  </Button>
                  <Button
                    variant={likedAgents.has(row.agent_id) ? 'destructive' : 'outline'}
                    size="sm"
                    title={likedAgents.has(row.agent_id) ? 'Descurtir este agente' : 'Curtir este agente'}
                    onClick={() => quickToggleLike(row.agent_id)}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    {likedAgents.has(row.agent_id) ? 'Descurtir' : 'Curtir'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const agent = agents.find(a => a.id === row.agent_id);
                      const slugOrId = agent?.slug || row.agent_id;
                      const params = new URLSearchParams();
                      if (row.first_time) params.set('from', new Date(row.first_time).toISOString());
                      if (row.last_time) params.set('to', new Date(row.last_time).toISOString());
                      params.set('source', 'history');
                      const link = `${window.location.origin}/agents/chat/${slugOrId}?${params.toString()}`;
                      try {
                        await navigator.clipboard.writeText(link);
                        toast({ title: 'Link copiado!', description: 'URL da conversa foi copiada para a área de transferência.' });
                      } catch {
                        toast({ title: 'Falha ao copiar', description: link, variant: 'destructive' });
                      }
                    }}
                  >
                    <Share className="h-4 w-4 mr-1" />
                    Compartilhar
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Exportar
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-sm">
          <span>Itens por página:</span>
          <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setOffset(0); }}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-3">Mostrando {total === 0 ? 0 : (offset + 1)}–{offset + rows.length} de {total}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={rows.length < limit} onClick={() => setOffset(offset + limit)}>
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}