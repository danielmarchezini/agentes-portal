import { useState } from "react";
import { useApp, Organization } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, FileText, CreditCard, Upload, Download, Calendar, MapPin, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hasPermission } from "@/lib/permissions";

// Import the mock data for fallback
const mockOrganization = {
  id: '1',
  name: 'Acme Corporation',
  domain: 'acme.com',
  cnpj: '12.345.678/0001-90',
  address: {
    street: 'Rua das Empresas',
    number: '123',
    complement: 'Sala 456',
    neighborhood: 'Centro Empresarial',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01234-567'
  },
  contacts: {
    phone: '(11) 9999-8888',
    email: 'contato@acme.com',
    responsibleName: 'João Silva',
    responsibleRole: 'CEO'
  },
  contract: {
    plan: 'Enterprise',
    startDate: '2024-01-01',
    expirationDate: '2024-12-31',
    monthlyValue: 2500.00,
    status: 'active' as const
  },
  notifications: {
    emailTemplates: {
      welcome: 'Bem-vindo à {{organizationName}}! Sua conta foi criada com sucesso.',
      invitation: 'Você foi convidado para participar da {{organizationName}}. Clique no link para aceitar.',
      passwordReset: 'Solicitação de redefinição de senha para {{organizationName}}.'
    },
    brandColor: '#0ea5e9'
  }
};

const OrganizationPage = () => {
  const { currentUser, organization, setOrganization } = useApp();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Organization>(organization || mockOrganization);

  if (!currentUser || !hasPermission(currentUser.role, "Gerenciar módulos e configurações da organização")) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Acesso Negado</h3>
          <p className="text-muted-foreground">Você não tem permissão para gerenciar a organização.</p>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    setOrganization(formData);
    setIsEditing(false);
    toast({
      title: "Organização atualizada!",
      description: "As informações da organização foram salvas com sucesso.",
    });
  };

  const getContractStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'suspended': return 'bg-warning text-warning-foreground';
      case 'expired': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getContractStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'suspended': return 'Suspenso';
      case 'expired': return 'Expirado';
      default: return status;
    }
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Organização não encontrada</h3>
          <p className="text-muted-foreground">Nenhuma organização foi configurada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organização</h1>
          <p className="text-muted-foreground">
            Gerencie as informações da sua organização, contrato e documentos
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-gradient-primary">
                Salvar Alterações
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="bg-gradient-primary">
              Editar Informações
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status do Contrato</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge className={getContractStatusColor(organization.contract.status)}>
              {getContractStatusLabel(organization.contract.status)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plano Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organization.contract.plan}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencimento</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {new Date(organization.contract.expirationDate).toLocaleDateString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {organization.contract.monthlyValue.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="address">Endereço</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="contract">Contrato</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Informações Gerais
              </CardTitle>
              <CardDescription>
                Dados básicos da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Nome da Empresa</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj || ''}
                    onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="domain">Domínio</Label>
                  <Input
                    id="domain"
                    value={formData.domain || ''}
                    onChange={(e) => setFormData({...formData, domain: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="address">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Endereço
              </CardTitle>
              <CardDescription>
                Endereço da sede da empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label htmlFor="street">Rua</Label>
                  <Input
                    id="street"
                    value={formData.address?.street || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, street: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="number">Número</Label>
                  <Input
                    id="number"
                    value={formData.address?.number || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, number: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    value={formData.address?.complement || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, complement: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={formData.address?.neighborhood || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, neighborhood: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.address?.city || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, city: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.address?.state || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, state: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="zipCode">CEP</Label>
                  <Input
                    id="zipCode"
                    value={formData.address?.zipCode || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, zipCode: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Contatos
              </CardTitle>
              <CardDescription>
                Informações de contato da empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.contacts?.phone || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: {...formData.contacts, phone: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.contacts?.email || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: {...formData.contacts, email: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="responsibleName">Nome do Responsável</Label>
                  <Input
                    id="responsibleName"
                    value={formData.contacts?.responsibleName || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: {...formData.contacts, responsibleName: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="responsibleRole">Cargo do Responsável</Label>
                  <Input
                    id="responsibleRole"
                    value={formData.contacts?.responsibleRole || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: {...formData.contacts, responsibleRole: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contract">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Informações do Contrato
              </CardTitle>
              <CardDescription>
                Dados do contrato e plano atual
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="plan">Plano</Label>
                  <Select
                    value={formData.contract?.plan || ''}
                    onValueChange={(value) => setFormData({
                      ...formData, 
                      contract: {...formData.contract, plan: value}
                    })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Basic">Básico</SelectItem>
                      <SelectItem value="Professional">Profissional</SelectItem>
                      <SelectItem value="Enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="monthlyValue">Valor Mensal (R$)</Label>
                  <Input
                    id="monthlyValue"
                    type="number"
                    value={formData.contract?.monthlyValue || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contract: {...formData.contract, monthlyValue: parseFloat(e.target.value)}
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="startDate">Data de Início</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.contract?.startDate || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contract: {...formData.contract, startDate: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="expirationDate">Data de Vencimento</Label>
                  <Input
                    id="expirationDate"
                    type="date"
                    value={formData.contract?.expirationDate || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contract: {...formData.contract, expirationDate: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.contract?.status || ''}
                    onValueChange={(value) => setFormData({
                      ...formData, 
                      contract: {...formData.contract, status: value as 'active' | 'suspended' | 'expired'}
                    })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documentos e Arquivos
              </CardTitle>
              <CardDescription>
                Gerencie os documentos relacionados ao contrato e à empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Upload de Documentos</h3>
                <p className="text-muted-foreground mb-4">
                  Arraste e solte arquivos aqui ou clique para selecionar
                </p>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Selecionar Arquivos
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Documentos Existentes</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Contrato_Assinado.pdf</div>
                        <div className="text-sm text-muted-foreground">Enviado em 15/01/2024</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Comprovante_CNPJ.pdf</div>
                        <div className="text-sm text-muted-foreground">Enviado em 10/01/2024</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrganizationPage;