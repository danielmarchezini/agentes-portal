import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, Plus, Edit, Trash2, Users, Calendar, 
  DollarSign, FileText, Mail, Phone, MapPin 
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
  domain: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  status: 'active' | 'suspended' | 'trial';
  planType: 'basic' | 'professional' | 'enterprise';
  userLimit: number;
  currentUsers: number;
  contractStart: Date;
  contractEnd: Date;
  monthlyFee: number;
  features: string[];
  createdAt: Date;
}

const mockOrganizations: Organization[] = [
  {
    id: '1',
    name: 'TechCorp Solutions',
    domain: 'techcorp.com',
    contactEmail: 'admin@techcorp.com',
    contactPhone: '+55 11 99999-9999',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    status: 'active',
    planType: 'enterprise',
    userLimit: 500,
    currentUsers: 247,
    contractStart: new Date('2024-01-01'),
    contractEnd: new Date('2024-12-31'),
    monthlyFee: 15000,
    features: ['unlimited_agents', 'api_access', 'priority_support', 'custom_branding'],
    createdAt: new Date('2023-12-15')
  },
  {
    id: '2',
    name: 'StartupXYZ',
    domain: 'startupxyz.com',
    contactEmail: 'founder@startupxyz.com',
    contactPhone: '+55 11 88888-8888',
    address: 'Rua Augusta, 500 - São Paulo, SP',
    status: 'trial',
    planType: 'professional',
    userLimit: 50,
    currentUsers: 23,
    contractStart: new Date('2024-01-15'),
    contractEnd: new Date('2024-02-15'),
    monthlyFee: 0,
    features: ['basic_agents', 'standard_support'],
    createdAt: new Date('2024-01-15')
  }
];

const planTypes = [
  { value: 'basic', label: 'Básico', userLimit: 25, monthlyFee: 2500 },
  { value: 'professional', label: 'Profissional', userLimit: 100, monthlyFee: 7500 },
  { value: 'enterprise', label: 'Enterprise', userLimit: 500, monthlyFee: 15000 }
];

const availableFeatures = [
  { id: 'unlimited_agents', label: 'Agentes Ilimitados' },
  { id: 'api_access', label: 'Acesso à API' },
  { id: 'priority_support', label: 'Suporte Prioritário' },
  { id: 'custom_branding', label: 'Marca Personalizada' },
  { id: 'advanced_analytics', label: 'Analytics Avançado' },
  { id: 'sso_integration', label: 'Integração SSO' },
  { id: 'backup_restore', label: 'Backup e Restauração' }
];

export default function SystemAdminPage() {
  const [organizations, setOrganizations] = useState(mockOrganizations);
  const [newOrg, setNewOrg] = useState({
    name: '',
    domain: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    planType: 'basic' as const,
    userLimit: 25,
    contractMonths: 12,
    features: [] as string[]
  });

  // Verificar se o usuário é admin do sistema (dmarchezini@gmail.com)
  const isSystemAdmin = true; // Simulação - em produção seria verificado pelo email

  if (!isSystemAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Apenas administradores do sistema podem acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleCreateOrganization = () => {
    if (!newOrg.name || !newOrg.domain || !newOrg.contactEmail) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const selectedPlan = planTypes.find(plan => plan.value === newOrg.planType);
    if (!selectedPlan) return;

    const organization: Organization = {
      id: Date.now().toString(),
      name: newOrg.name,
      domain: newOrg.domain,
      contactEmail: newOrg.contactEmail,
      contactPhone: newOrg.contactPhone,
      address: newOrg.address,
      status: 'trial',
      planType: newOrg.planType,
      userLimit: selectedPlan.userLimit,
      currentUsers: 0,
      contractStart: new Date(),
      contractEnd: new Date(Date.now() + (newOrg.contractMonths * 30 * 24 * 60 * 60 * 1000)),
      monthlyFee: selectedPlan.monthlyFee,
      features: newOrg.features,
      createdAt: new Date()
    };

    setOrganizations([...organizations, organization]);
    toast.success(`Organização "${newOrg.name}" criada com sucesso`);
    
    // Reset form
    setNewOrg({
      name: '',
      domain: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
      planType: 'basic',
      userLimit: 25,
      contractMonths: 12,
      features: []
    });
  };

  const handlePlanChange = (planValue: string) => {
    const plan = planTypes.find(p => p.value === planValue);
    if (plan) {
      setNewOrg(prev => ({
        ...prev,
        planType: planValue as any,
        userLimit: plan.userLimit
      }));
    }
  };

  const toggleFeature = (featureId: string) => {
    setNewOrg(prev => ({
      ...prev,
      features: prev.features.includes(featureId)
        ? prev.features.filter(id => id !== featureId)
        : [...prev.features, featureId]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'suspended': return 'bg-red-500';
      case 'trial': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'suspended': return 'Suspenso';
      case 'trial': return 'Trial';
      default: return 'Desconhecido';
    }
  };

  const getPlanLabel = (planType: string) => {
    return planTypes.find(p => p.value === planType)?.label || planType;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Administração do Sistema</h1>
          <p className="text-muted-foreground">
            Gerencie organizações e configurações globais do sistema
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Organização
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Organização</DialogTitle>
              <DialogDescription>
                Configure uma nova organização no sistema
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="org-name">Nome da Organização *</Label>
                  <Input
                    id="org-name"
                    value={newOrg.name}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: TechCorp Solutions"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="org-domain">Domínio *</Label>
                  <Input
                    id="org-domain"
                    value={newOrg.domain}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, domain: e.target.value }))}
                    placeholder="Ex: techcorp.com"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="contact-email">Email de Contato *</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={newOrg.contactEmail}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="admin@empresa.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact-phone">Telefone</Label>
                  <Input
                    id="contact-phone"
                    value={newOrg.contactPhone}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, contactPhone: e.target.value }))}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address">Endereço</Label>
                <Textarea
                  id="address"
                  value={newOrg.address}
                  onChange={(e) => setNewOrg(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Endereço completo da organização"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="plan-type">Plano</Label>
                  <Select value={newOrg.planType} onValueChange={handlePlanChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {planTypes.map(plan => (
                        <SelectItem key={plan.value} value={plan.value}>
                          {plan.label} - {plan.userLimit} usuários - R$ {plan.monthlyFee.toLocaleString()}/mês
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contract-months">Contrato (meses)</Label>
                  <Input
                    id="contract-months"
                    type="number"
                    value={newOrg.contractMonths}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, contractMonths: parseInt(e.target.value) || 12 }))}
                    min="1"
                    max="36"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Funcionalidades</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-lg p-3">
                  {availableFeatures.map(feature => (
                    <div key={feature.id} className="flex items-center space-x-2">
                      <Switch
                        id={feature.id}
                        checked={newOrg.features.includes(feature.id)}
                        onCheckedChange={() => toggleFeature(feature.id)}
                      />
                      <Label htmlFor={feature.id} className="text-sm">
                        {feature.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline">Cancelar</Button>
              <Button onClick={handleCreateOrganization}>Criar Organização</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Organizações</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations.length}</div>
            <p className="text-xs text-muted-foreground">Organizações ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Totais</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.reduce((acc, org) => acc + org.currentUsers, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Usuários em todas as organizações</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {organizations.reduce((acc, org) => acc + org.monthlyFee, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Receita recorrente mensal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizações em Trial</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter(org => org.status === 'trial').length}
            </div>
            <p className="text-xs text-muted-foreground">Potenciais conversões</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Organizações */}
      <div className="space-y-4">
        {organizations.map((org) => (
          <Card key={org.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{org.name}</h3>
                    <Badge className={getStatusColor(org.status)}>
                      {getStatusLabel(org.status)}
                    </Badge>
                    <Badge variant="outline">
                      {getPlanLabel(org.planType)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Mail className="h-4 w-4 mr-2" />
                        {org.contactEmail}
                      </div>
                      {org.contactPhone && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Phone className="h-4 w-4 mr-2" />
                          {org.contactPhone}
                        </div>
                      )}
                      {org.address && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-2" />
                          {org.address}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Usuários: </span>
                        <span className="font-medium">{org.currentUsers}/{org.userLimit}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Mensalidade: </span>
                        <span className="font-medium">R$ {org.monthlyFee.toLocaleString()}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Domínio: </span>
                        <span className="font-medium">{org.domain}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Início: </span>
                        <span className="font-medium">{org.contractStart.toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Fim: </span>
                        <span className="font-medium">{org.contractEnd.toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Criada em: </span>
                        <span className="font-medium">{org.createdAt.toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Funcionalidades */}
                  <div>
                    <p className="text-sm font-medium mb-2">Funcionalidades:</p>
                    <div className="flex flex-wrap gap-1">
                      {org.features.map((featureId) => {
                        const feature = availableFeatures.find(f => f.id === featureId);
                        return feature ? (
                          <Badge key={featureId} variant="secondary" className="text-xs">
                            {feature.label}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4" />
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