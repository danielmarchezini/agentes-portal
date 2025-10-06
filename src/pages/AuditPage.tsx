import React, { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Shield, Download, Filter, Search, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useApp } from '@/contexts/AppContext';
import { hasPermission } from '@/lib/permissions';

interface AuditLogDB {
  id: string;
  created_at: string;
  actor_id: string | null;
  organization_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: any;
}

export default function AuditPage() {
  const { currentUser, organization } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [logs, setLogs] = useState<AuditLogDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  if (!currentUser || !hasPermission(currentUser.role, 'Ver logs de auditoria')) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar os logs de auditoria.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    const loadLogs = async () => {
      if (!organization?.id && !currentUser) return;
      setLoading(true);
      setErrorMsg(null);

      // Base select com count para paginação
      let query = supabase
        .from('audit_logs')
        .select('id, created_at, actor_id, organization_id, action, entity, entity_id, details', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (organization?.id) query = query.eq('organization_id', organization.id);
      if (filterAction !== 'all') query = query.eq('action', filterAction);
      if (filterEntity !== 'all') query = query.eq('entity', filterEntity);
      if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59');
        query = query.lte('created_at', end.toISOString());
      }

      // range para paginação
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) {
        setErrorMsg(error.message);
        setLogs([]);
        setTotalCount(0);
      } else {
        setLogs((data || []) as any);
        setTotalCount(count || 0);
      }
      setLoading(false);
    };
    loadLogs();
  }, [organization?.id, filterAction, filterEntity, startDate, endDate, page, pageSize]);

  const pageItems = useMemo(() => {
    // Busca por texto client-side nos itens da página
    return logs.filter((log) => {
      const text = `${log.action} ${log.entity || ''} ${JSON.stringify(log.details || {})}`.toLowerCase();
      return text.includes(searchTerm.toLowerCase());
    });
  }, [logs, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);

  const getActionBadge = (action: string) => (
    <Badge variant="outline" className="text-xs">{action}</Badge>
  );

  const exportLogs = () => {
    // Exporta os itens carregados (página atual com filtros server-side)
    const rows = logs.map((l) => [
      l.created_at,
      l.actor_id || '',
      l.action,
      l.entity || '',
      l.entity_id || '',
      JSON.stringify(l.details || {})
    ].join(','));
    const header = 'created_at,actor_id,action,entity,entity_id,details';
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="w-full px-4 md:px-8 py-4 space-y-3 md:space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Auditoria do Sistema</h1>
          <p className="text-muted-foreground">
            Monitore todas as ações e eventos do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Logs
          </Button>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filtros Avançados
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 xl:grid-cols-5 2xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,847</div>
            <p className="text-xs text-muted-foreground">+234 hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos com Sucesso</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">11,956</div>
            <p className="text-xs text-muted-foreground">93.1% de sucesso</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avisos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">567</div>
            <p className="text-xs text-muted-foreground">4.4% do total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Erros</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">324</div>
            <p className="text-xs text-muted-foreground">2.5% do total</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger>
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {[...new Set(logs.map(l => l.action))].map(action => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger>
                <SelectValue placeholder="Entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as entidades</SelectItem>
                {[...new Set(logs.map(l => l.entity || ''))]
                  .filter(Boolean)
                  .map(entity => (
                    <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div>
              <label className="text-xs text-muted-foreground">Início</label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fim</label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs de Auditoria */}
      <Card>
        <CardHeader>
          <CardTitle>Logs de Auditoria</CardTitle>
          <CardDescription>
            Histórico detalhado de todas as ações do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : errorMsg ? (
            <p className="text-sm text-destructive">{errorMsg}</p>
          ) : (
            <div className="space-y-3">
              {pageItems.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getActionBadge(log.action)}
                          {log.entity && (
                            <Badge variant="secondary" className="text-xs">{log.entity}</Badge>
                          )}
                          {log.entity_id && (
                            <Badge variant="outline" className="text-xs">{log.entity_id}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 break-words">
                          {JSON.stringify(log.details || {})}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </span>
                          {log.actor_id && (
                            <span>
                              <Shield className="h-3 w-3 inline mr-1" />
                              {log.actor_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {pageItems.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum log encontrado.</p>
              )}
              {/* Pagination */}
              {totalCount > 0 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-xs text-muted-foreground">
                    Página {currentPage} de {totalPages} — {totalCount} registros
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                      Próxima
                    </Button>
                    <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                      <SelectTrigger className="w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}