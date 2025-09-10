import React, { useState } from 'react';
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

interface UserGroup {
  id: string;
  name: string;
  description: string;
  members: string[];
  permissions: string[];
  createdBy: string;
  createdAt: Date;
  color: string;
}

const mockUserGroups: UserGroup[] = [
  {
    id: '1',
    name: 'Equipe de Vendas',
    description: 'Equipe responsável por vendas e relacionamento com clientes',
    members: ['João Silva', 'Maria Santos', 'Pedro Costa'],
    permissions: ['access_sales_agents', 'view_reports', 'manage_leads'],
    createdBy: 'Admin',
    createdAt: new Date('2024-01-15'),
    color: 'bg-blue-500'
  },
  {
    id: '2',
    name: 'Suporte Técnico',
    description: 'Equipe de suporte e atendimento técnico',
    members: ['Ana Oliveira', 'Carlos Lima'],
    permissions: ['access_support_agents', 'manage_tickets', 'view_system_logs'],
    createdBy: 'Admin',
    createdAt: new Date('2024-01-16'),
    color: 'bg-green-500'
  },
  {
    id: '3',
    name: 'Marketing',
    description: 'Equipe de marketing e comunicação',
    members: ['Fernanda Silva', 'Roberto Santos'],
    permissions: ['access_marketing_agents', 'manage_campaigns', 'view_analytics'],
    createdBy: 'Admin',
    createdAt: new Date('2024-01-17'),
    color: 'bg-purple-500'
  }
];

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
  const { currentUser, users } = useApp();
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

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

  const handleCreateGroup = () => {
    if (!groupName.trim()) {
      toast.error('Nome do grupo é obrigatório');
      return;
    }

    toast.success(`Grupo "${groupName}" criado com sucesso`);
    setGroupName('');
    setGroupDescription('');
    setSelectedMembers([]);
    setSelectedPermissions([]);
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
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Grupos de Usuários</h1>
          <p className="text-muted-foreground">
            Organize usuários em equipes e gerencie permissões
          </p>
        </div>
        <div className="flex gap-2">
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
                  Crie um grupo de usuários e defina suas permissões
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
                  <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                    {availablePermissions.map((permission) => (
                      <div key={permission.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={permission.id}
                          checked={selectedPermissions.includes(permission.id)}
                          onCheckedChange={() => handlePermissionToggle(permission.id)}
                        />
                        <Label htmlFor={permission.id} className="text-sm cursor-pointer">
                          {permission.label}
                        </Label>
                      </div>
                    ))}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Grupos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockUserGroups.length}</div>
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
              {mockUserGroups.reduce((acc, group) => acc + group.members.length, 0)}
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
              {Math.max(...mockUserGroups.map(g => g.members.length))}
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
      <div className="space-y-4">
        {mockUserGroups.map((group) => (
          <Card key={group.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-4 h-4 rounded-full ${group.color}`}></div>
                    <h3 className="font-semibold text-lg">{group.name}</h3>
                    <Badge variant="secondary">
                      {group.members.length} membros
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-3">{group.description}</p>
                  
                  {/* Membros */}
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-2">Membros:</p>
                    <div className="flex flex-wrap gap-2">
                      {group.members.slice(0, 5).map((member, index) => (
                        <div key={index} className="flex items-center gap-1 bg-muted rounded-full px-2 py-1">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member}`} />
                            <AvatarFallback className="text-xs">
                              {member.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{member}</span>
                        </div>
                      ))}
                      {group.members.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{group.members.length - 5} mais
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Permissões */}
                  <div>
                    <p className="text-sm font-medium mb-2">Permissões:</p>
                    <div className="flex flex-wrap gap-1">
                      {group.permissions.slice(0, 3).map((permission) => {
                        const permissionLabel = availablePermissions.find(p => p.id === permission)?.label;
                        return (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {permissionLabel}
                          </Badge>
                        );
                      })}
                      {group.permissions.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{group.permissions.length - 3} mais
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground">
                    Criado por {group.createdBy} em {group.createdAt.toLocaleDateString('pt-BR')}
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button variant="outline" size="sm">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
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