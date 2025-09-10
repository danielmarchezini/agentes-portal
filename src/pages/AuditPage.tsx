import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Shield, Download, Filter, Search, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useApp } from '@/contexts/AppContext';
import { hasPermission } from '@/lib/permissions';

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'warning' | 'error';
  details: string;
}

const mockAuditLogs: AuditLog[] = [
  {
    id: '1',
    userId: 'user1',
    userName: 'João Silva',
    action: 'LOGIN',
    resource: 'AUTH',
    resourceId: 'auth-session-1',
    timestamp: new Date('2024-01-16T09:15:30'),
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    status: 'success',
    details: 'Login realizado com sucesso'
  },
  {
    id: '2',
    userId: 'user2',
    userName: 'Maria Santos',
    action: 'CREATE_AGENT',
    resource: 'AGENT',
    resourceId: 'agent-123',
    timestamp: new Date('2024-01-16T10:30:15'),
    ipAddress: '192.168.1.105',
    userAgent: 'Mozilla/5.0 (MacOS) AppleWebKit/537.36',
    status: 'success',
    details: 'Criado agente "Assistente de Vendas Premium"'
  },
  {
    id: '3',
    userId: 'user3',
    userName: 'Pedro Costa',
    action: 'UPDATE_USER',
    resource: 'USER',
    resourceId: 'user-456',
    timestamp: new Date('2024-01-16T11:45:22'),
    ipAddress: '192.168.1.110',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
    status: 'success',
    details: 'Atualizado perfil do usuário'
  },
  {
    id: '4',
    userId: 'user1',
    userName: 'João Silva',
    action: 'DELETE_AGENT',
    resource: 'AGENT',
    resourceId: 'agent-789',
    timestamp: new Date('2024-01-16T14:20:45'),
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    status: 'warning',
    details: 'Agente "Teste" foi removido'
  },
  {
    id: '5',
    userId: 'user4',
    userName: 'Ana Oliveira',
    action: 'FAILED_LOGIN',
    resource: 'AUTH',
    resourceId: 'auth-failed-1',
    timestamp: new Date('2024-01-16T15:30:12'),
    ipAddress: '203.0.113.5',
    userAgent: 'Mozilla/5.0 (Unknown)',
    status: 'error',
    details: 'Tentativa de login com credenciais inválidas'
  }
];

const actionTypes = [
  'LOGIN', 'LOGOUT', 'CREATE_AGENT', 'UPDATE_AGENT', 'DELETE_AGENT',
  'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'SHARE_AGENT',
  'EXPORT_DATA', 'IMPORT_DATA', 'FAILED_LOGIN'
];

const resourceTypes = ['AUTH', 'AGENT', 'USER', 'ORGANIZATION', 'SYSTEM'];

export default function AuditPage() {
  const { currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterResource, setFilterResource] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

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

  const filteredLogs = mockAuditLogs.filter(log => {
    const matchesSearch = log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesResource = filterResource === 'all' || log.resource === filterResource;
    const matchesStatus = filterStatus === 'all' || log.status === filterStatus;
    const matchesUser = filterUser === 'all' || log.userName === filterUser;
    
    return matchesSearch && matchesAction && matchesResource && matchesStatus && matchesUser;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success': return 'Sucesso';
      case 'warning': return 'Aviso';
      case 'error': return 'Erro';
      default: return 'Desconhecido';
    }
  };

  const exportLogs = () => {
    // Simulação de exportação
    const csvContent = filteredLogs.map(log => 
      `${log.timestamp.toISOString()},${log.userName},${log.action},${log.resource},${log.status},${log.details}`
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                {actionTypes.map(action => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterResource} onValueChange={setFilterResource}>
              <SelectTrigger>
                <SelectValue placeholder="Recurso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os recursos</SelectItem>
                {resourceTypes.map(resource => (
                  <SelectItem key={resource} value={resource}>{resource}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger>
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                <SelectItem value="João Silva">João Silva</SelectItem>
                <SelectItem value="Maria Santos">Maria Santos</SelectItem>
                <SelectItem value="Pedro Costa">Pedro Costa</SelectItem>
                <SelectItem value="Ana Oliveira">Ana Oliveira</SelectItem>
              </SelectContent>
            </Select>
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
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(log.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{log.userName}</span>
                        <Badge variant="outline" className="text-xs">
                          {log.action}
                        </Badge>
                        <Badge className={getStatusColor(log.status)}>
                          {getStatusLabel(log.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {log.details}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {log.timestamp.toLocaleString('pt-BR')}
                        </span>
                        <span>
                          <Shield className="h-3 w-3 inline mr-1" />
                          {log.ipAddress}
                        </span>
                        <span>Recurso: {log.resource}</span>
                        <span>ID: {log.resourceId}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}