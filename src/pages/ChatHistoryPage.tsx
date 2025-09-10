import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, MessageSquare, Search, Filter, Download, Trash2, Share } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { hasPermission } from '@/lib/permissions';

interface ChatHistory {
  id: string;
  agentName: string;
  userName: string;
  startTime: Date;
  endTime: Date;
  messageCount: number;
  status: 'active' | 'completed' | 'archived';
  lastMessage: string;
  topics: string[];
}

const mockChatHistory: ChatHistory[] = [
  {
    id: '1',
    agentName: 'Assistente de Vendas',
    userName: 'João Silva',
    startTime: new Date('2024-01-15T09:00:00'),
    endTime: new Date('2024-01-15T09:45:00'),
    messageCount: 23,
    status: 'completed',
    lastMessage: 'Obrigado pela ajuda com a proposta comercial!',
    topics: ['vendas', 'proposta', 'pricing']
  },
  {
    id: '2',
    agentName: 'Suporte Técnico',
    userName: 'Maria Santos',
    startTime: new Date('2024-01-15T14:30:00'),
    endTime: new Date('2024-01-15T15:15:00'),
    messageCount: 31,
    status: 'completed',
    lastMessage: 'Problema resolvido, muito obrigada!',
    topics: ['suporte', 'bug', 'sistema']
  },
  {
    id: '3',
    agentName: 'Assistente de Marketing',
    userName: 'Pedro Costa',
    startTime: new Date('2024-01-16T10:00:00'),
    endTime: new Date(),
    messageCount: 12,
    status: 'active',
    lastMessage: 'Vou revisar a estratégia e te retorno...',
    topics: ['marketing', 'campanha', 'redes sociais']
  }
];

export default function ChatHistoryPage() {
  const { currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

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

  const filteredHistory = mockChatHistory.filter(chat => {
    const matchesSearch = chat.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         chat.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAgent = filterAgent === 'all' || chat.agentName === filterAgent;
    const matchesStatus = filterStatus === 'all' || chat.status === filterStatus;
    
    return matchesSearch && matchesAgent && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'completed': return 'Finalizado';
      case 'archived': return 'Arquivado';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Histórico de Conversas</h1>
          <p className="text-muted-foreground">
            Gerencie e revise todas as conversas dos agentes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
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
            <CardTitle className="text-sm font-medium">Total de Conversas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">+12% em relação ao mês anterior</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
            <MessageSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">Em andamento agora</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23m</div>
            <p className="text-xs text-muted-foreground">Duração média por conversa</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfação</CardTitle>
            <MessageSquare className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.8/5</div>
            <p className="text-xs text-muted-foreground">Avaliação média dos usuários</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por agente, usuário ou mensagem..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por agente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os agentes</SelectItem>
                <SelectItem value="Assistente de Vendas">Assistente de Vendas</SelectItem>
                <SelectItem value="Suporte Técnico">Suporte Técnico</SelectItem>
                <SelectItem value="Assistente de Marketing">Assistente de Marketing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="completed">Finalizado</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Conversas */}
      <div className="space-y-4">
        {filteredHistory.map((chat) => (
          <Card key={chat.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{chat.agentName}</h3>
                    <Badge className={getStatusColor(chat.status)}>
                      {getStatusLabel(chat.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Usuário: {chat.userName} • {chat.messageCount} mensagens
                  </p>
                  <p className="text-sm">
                    Início: {chat.startTime.toLocaleString('pt-BR')}
                    {chat.status === 'completed' && (
                      <span> • Fim: {chat.endTime.toLocaleString('pt-BR')}</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    "{chat.lastMessage}"
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {chat.topics.map((topic) => (
                      <Badge key={topic} variant="secondary" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="outline" size="sm">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Ver Conversa
                  </Button>
                  <Button variant="outline" size="sm">
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
    </div>
  );
}