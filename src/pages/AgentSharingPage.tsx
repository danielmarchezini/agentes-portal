import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Share2, Users, Copy, Mail, MessageSquare, Settings, Eye, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/contexts/AppContext';
import { hasPermission } from '@/lib/permissions';
import { toast } from 'sonner';

interface SharedAgent {
  id: string;
  agentName: string;
  agentDescription: string;
  sharedBy: string;
  sharedWith: string[];
  shareType: 'view' | 'edit' | 'admin';
  sharedAt: Date;
  usageCount: number;
  isPublic: boolean;
}

const mockSharedAgents: SharedAgent[] = [
  {
    id: '1',
    agentName: 'Assistente de Vendas Premium',
    agentDescription: 'Especialista em vendas B2B com técnicas avançadas de negociação',
    sharedBy: 'João Silva',
    sharedWith: ['Maria Santos', 'Pedro Costa', 'Ana Oliveira'],
    shareType: 'edit',
    sharedAt: new Date('2024-01-15T09:00:00'),
    usageCount: 47,
    isPublic: false
  },
  {
    id: '2',
    agentName: 'Suporte Técnico Avançado',
    agentDescription: 'Agente especializado em resolver problemas técnicos complexos',
    sharedBy: 'Maria Santos',
    sharedWith: ['João Silva', 'Carlos Lima'],
    shareType: 'view',
    sharedAt: new Date('2024-01-16T14:30:00'),
    usageCount: 23,
    isPublic: true
  }
];

export default function AgentSharingPage() {
  const { currentUser, agents, users } = useApp();
  const [selectedAgent, setSelectedAgent] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('view');
  const [shareMessage, setShareMessage] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  if (!currentUser || !hasPermission(currentUser.role, 'manage_agents')) {
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

  const handleShareAgent = () => {
    if (!selectedAgent || !shareEmail) {
      toast.error('Selecione um agente e informe o email do usuário');
      return;
    }

    // Simulação de compartilhamento
    toast.success(`Agente compartilhado com ${shareEmail} com permissão de ${sharePermission}`);
    setSelectedAgent('');
    setShareEmail('');
    setShareMessage('');
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

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Compartilhamento de Agentes</h1>
          <p className="text-muted-foreground">
            Compartilhe agentes entre usuários da organização
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
                <Label htmlFor="email">Email do usuário</Label>
                <Input
                  id="email"
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="permission">Nível de permissão</Label>
                <Select value={sharePermission} onValueChange={setSharePermission}>
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
              <div className="flex items-center space-x-2">
                <Switch
                  id="public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
                <Label htmlFor="public">Tornar público na organização</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline">Cancelar</Button>
              <Button onClick={handleShareAgent}>
                <Share2 className="h-4 w-4 mr-2" />
                Compartilhar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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

      {/* Agentes Compartilhados */}
      <Card>
        <CardHeader>
          <CardTitle>Agentes Compartilhados</CardTitle>
          <CardDescription>
            Gerencie todos os agentes compartilhados na organização
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockSharedAgents.map((shared) => (
              <div key={shared.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{shared.agentName}</h3>
                      <Badge className={getPermissionColor(shared.shareType)}>
                        {getPermissionLabel(shared.shareType)}
                      </Badge>
                      {shared.isPublic && (
                        <Badge variant="outline">Público</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {shared.agentDescription}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Compartilhado por: {shared.sharedBy}</span>
                      <span>Data: {shared.sharedAt.toLocaleDateString('pt-BR')}</span>
                      <span>Usos: {shared.usageCount}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => copyShareLink(shared.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Usuários com acesso */}
                <div>
                  <p className="text-sm font-medium mb-2">Compartilhado com:</p>
                  <div className="flex flex-wrap gap-2">
                    {shared.sharedWith.map((userName, index) => (
                      <div key={index} className="flex items-center gap-1 bg-muted rounded-full px-2 py-1">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`} />
                          <AvatarFallback className="text-xs">
                            {userName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{userName}</span>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="h-6 px-2">
                      <Mail className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
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