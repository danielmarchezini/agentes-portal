import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Mail, Bell, Shield, Palette, Send, TestTube, CheckCircle, AlertCircle, Bot, Key, Save, Upload, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hasPermission } from "@/lib/permissions";

const SettingsPage = () => {
  const { currentUser, organization, setOrganization } = useApp();
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    notifications: true,
    emailAlerts: true,
    darkMode: false,
    autoSave: true
  });
  const [smtpConfig, setSmtpConfig] = useState(organization?.smtp || {
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: ''
  });
  const [emailTemplates, setEmailTemplates] = useState(organization?.notifications?.emailTemplates || {
    welcome: '',
    invitation: '',
    passwordReset: ''
  });
  const [testEmail, setTestEmail] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [branding, setBranding] = useState(organization?.branding || {
    logo: '',
    colors: {
      primary: '222.2 84% 4.9%',
      secondary: '210 40% 98%',
      accent: '210 40% 96%'
    }
  });

  if (!currentUser || !hasPermission(currentUser.role, "Gerenciar módulos e configurações da organização")) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Acesso Negado</h3>
          <p className="text-muted-foreground">Você não tem permissão para acessar as configurações.</p>
        </div>
      </div>
    );
  };

  const handleSave = () => {
    toast({
      title: "Configurações salvas!",
      description: "Suas configurações foram atualizadas com sucesso.",
    });
  };

  const handleSaveSMTP = () => {
    if (organization) {
      setOrganization({
        ...organization,
        smtp: smtpConfig
      });
    }
    toast({
      title: "SMTP configurado!",
      description: "As configurações de e-mail foram salvas com sucesso.",
    });
  };

  const handleSaveTemplates = () => {
    if (organization) {
      setOrganization({
        ...organization,
        notifications: {
          ...organization.notifications,
          emailTemplates
        }
      });
    }
    toast({
      title: "Templates salvos!",
      description: "Os templates de e-mail foram atualizados com sucesso.",
    });
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: "Email obrigatório",
        description: "Digite um e-mail para enviar o teste.",
        variant: "destructive"
      });
      return;
    }

    setIsTestingEmail(true);
    
    // Simular envio de email
    setTimeout(() => {
      setIsTestingEmail(false);
      toast({
        title: "E-mail de teste enviado!",
        description: `Um e-mail de teste foi enviado para ${testEmail}`,
      });
    }, 2000);
  };

  const handleSaveBranding = () => {
    if (organization) {
      setOrganization({
        ...organization,
        branding
      });
    }
    
    // Apply colors to document root
    const root = document.documentElement;
    if (branding.colors?.primary) {
      root.style.setProperty('--primary', branding.colors.primary);
    }
    if (branding.colors?.secondary) {
      root.style.setProperty('--secondary', branding.colors.secondary);
    }
    if (branding.colors?.accent) {
      root.style.setProperty('--accent', branding.colors.accent);
    }
    
    toast({
      title: "Marca salva!",
      description: "As configurações de marca foram atualizadas com sucesso.",
    });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBranding({
          ...branding,
          logo: e.target?.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações da sua organização e notificações
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="branding">Marca</TabsTrigger>
          <TabsTrigger value="llm">LLM/IA</TabsTrigger>
          <TabsTrigger value="smtp">E-mail/SMTP</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="security">Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configurações Gerais
              </CardTitle>
              <CardDescription>
                Configurações básicas do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Salvamento Automático</Label>
                  <p className="text-sm text-muted-foreground">
                    Salvar alterações automaticamente
                  </p>
                </div>
                <Switch
                  checked={settings.autoSave}
                  onCheckedChange={(checked) => setSettings({...settings, autoSave: checked})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Identidade Visual
              </CardTitle>
              <CardDescription>
                Personalize as cores e logomarca da sua organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <div className="space-y-4">
                <div>
                  <Label>Logomarca</Label>
                  <p className="text-sm text-muted-foreground">
                    Faça upload da logo da sua empresa (PNG, JPG ou SVG)
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {branding.logo && (
                    <div className="relative w-20 h-20 border rounded-lg overflow-hidden bg-muted">
                      <img 
                        src={branding.logo} 
                        alt="Logo preview" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button asChild variant="outline">
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        {branding.logo ? 'Alterar Logo' : 'Upload Logo'}
                      </label>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Color Customization */}
              <div className="space-y-4">
                <div>
                  <Label>Cores do Sistema</Label>
                  <p className="text-sm text-muted-foreground">
                    Personalize as cores principais do sistema (formato HSL)
                  </p>
                </div>
                
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="primary-color">Cor Primária</Label>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-10 h-10 rounded border"
                        style={{ backgroundColor: `hsl(${branding.colors?.primary})` }}
                      />
                      <Input
                        id="primary-color"
                        placeholder="222.2 84% 4.9%"
                        value={branding.colors?.primary || ''}
                        onChange={(e) => setBranding({
                          ...branding,
                          colors: { ...branding.colors, primary: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="secondary-color">Cor Secundária</Label>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-10 h-10 rounded border"
                        style={{ backgroundColor: `hsl(${branding.colors?.secondary})` }}
                      />
                      <Input
                        id="secondary-color"
                        placeholder="210 40% 98%"
                        value={branding.colors?.secondary || ''}
                        onChange={(e) => setBranding({
                          ...branding,
                          colors: { ...branding.colors, secondary: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="accent-color">Cor de Destaque</Label>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-10 h-10 rounded border"
                        style={{ backgroundColor: `hsl(${branding.colors?.accent})` }}
                      />
                      <Input
                        id="accent-color"
                        placeholder="210 40% 96%"
                        value={branding.colors?.accent || ''}
                        onChange={(e) => setBranding({
                          ...branding,
                          colors: { ...branding.colors, accent: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-2">Pré-visualização das cores:</p>
                  <div className="flex gap-2">
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                      Botão Primário
                    </Button>
                    <Button variant="secondary">
                      Botão Secundário
                    </Button>
                    <Button variant="outline">
                      Botão Outline
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={handleSaveBranding} className="bg-gradient-primary">
                  Salvar Configurações de Marca
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="llm">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Configuração de LLMs
              </CardTitle>
              <CardDescription>
                Configure os provedores de IA disponíveis para os agentes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {organization?.llmProviders?.map((provider) => (
                <div key={provider.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5" />
                        <h3 className="font-semibold">{provider.name}</h3>
                      </div>
                      {provider.apiKeyRequired && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Key className="w-3 h-3" />
                          API Key necessária
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={provider.enabled}
                      onCheckedChange={(checked) => {
                        if (organization) {
                          const updatedProviders = organization.llmProviders?.map(p =>
                            p.id === provider.id ? { ...p, enabled: checked } : p
                          );
                          setOrganization({
                            ...organization,
                            llmProviders: updatedProviders
                          });
                        }
                      }}
                    />
                  </div>
                  
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {provider.models.map((model) => (
                      <div key={model.id} className="p-3 border rounded bg-muted/30">
                        <p className="font-medium text-sm">{model.name}</p>
                        {model.description && (
                          <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {provider.apiKeyRequired && provider.enabled && (
                    <div className="space-y-2">
                      <Label htmlFor={`apikey-${provider.id}`}>API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`apikey-${provider.id}`}
                          type="password"
                          placeholder="Insira sua API Key"
                        />
                        <Button size="sm" variant="outline">
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={handleSave} className="bg-gradient-primary">
                  Salvar Configurações de LLM
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Configuração SMTP
              </CardTitle>
              <CardDescription>
                Configure o servidor SMTP da sua organização para envio de e-mails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="smtp-host">Servidor SMTP</Label>
                  <Input
                    id="smtp-host"
                    placeholder="smtp.gmail.com"
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({...smtpConfig, host: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="smtp-port">Porta</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    placeholder="587"
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({...smtpConfig, port: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="smtp-username">Usuário</Label>
                  <Input
                    id="smtp-username"
                    type="email"
                    placeholder="seu-email@empresa.com"
                    value={smtpConfig.username}
                    onChange={(e) => setSmtpConfig({...smtpConfig, username: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="smtp-password">Senha</Label>
                  <Input
                    id="smtp-password"
                    type="password"
                    placeholder="••••••••"
                    value={smtpConfig.password}
                    onChange={(e) => setSmtpConfig({...smtpConfig, password: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="smtp-secure"
                  checked={smtpConfig.secure}
                  onCheckedChange={(checked) => setSmtpConfig({...smtpConfig, secure: checked})}
                />
                <Label htmlFor="smtp-secure">Usar SSL/TLS</Label>
              </div>
              <div className="border-t pt-6">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="test-email">Testar Configuração</Label>
                    <Input
                      id="test-email"
                      type="email"
                      placeholder="email@teste.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleTestEmail} disabled={isTestingEmail} variant="outline">
                    {isTestingEmail ? (
                      <>
                        <TestTube className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Testar
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveSMTP} className="bg-gradient-primary">
                  Salvar Configurações SMTP
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Templates de E-mail
              </CardTitle>
              <CardDescription>
                Personalize os templates de e-mail enviados pelo sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="welcome-template">Template de Boas-vindas</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Variáveis disponíveis: organizationName, userName, userEmail
                </p>
                <Textarea
                  id="welcome-template"
                  placeholder="Bem-vindo à {{organizationName}}! Sua conta foi criada com sucesso."
                  value={emailTemplates.welcome}
                  onChange={(e) => setEmailTemplates({...emailTemplates, welcome: e.target.value})}
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="invitation-template">Template de Convite</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Variáveis disponíveis: organizationName, inviterName, inviteLink
                </p>
                <Textarea
                  id="invitation-template"
                  placeholder="Você foi convidado para participar da {{organizationName}}. Clique no link para aceitar: {{inviteLink}}"
                  value={emailTemplates.invitation}
                  onChange={(e) => setEmailTemplates({...emailTemplates, invitation: e.target.value})}
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="password-reset-template">Template de Redefinição de Senha</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Variáveis disponíveis: organizationName, resetLink, userName
                </p>
                <Textarea
                  id="password-reset-template"
                  placeholder="Solicitação de redefinição de senha para {{organizationName}}. Clique no link: {{resetLink}}"
                  value={emailTemplates.passwordReset}
                  onChange={(e) => setEmailTemplates({...emailTemplates, passwordReset: e.target.value})}
                  rows={4}
                />
              </div>
              <Button onClick={handleSaveTemplates} className="bg-gradient-primary">
                Salvar Templates
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notificações
              </CardTitle>
              <CardDescription>
                Configure como e quando você deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificações por E-mail</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba notificações importantes por e-mail
                  </p>
                </div>
                <Switch
                  checked={settings.emailAlerts}
                  onCheckedChange={(checked) => setSettings({...settings, emailAlerts: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificações Push</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba notificações instantâneas no navegador
                  </p>
                </div>
                <Switch
                  checked={settings.notifications}
                  onCheckedChange={(checked) => setSettings({...settings, notifications: checked})}
                />
              </div>
              <div className="space-y-4 border-t pt-6">
                <h4 className="font-medium">Tipos de Notificação</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Novos usuários</Label>
                      <p className="text-sm text-muted-foreground">Quando um novo usuário se cadastrar</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Agentes criados</Label>
                      <p className="text-sm text-muted-foreground">Quando um novo agente for criado</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Sugestões de prompt</Label>
                      <p className="text-sm text-muted-foreground">Quando houver sugestões pendentes</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Vencimento de contrato</Label>
                      <p className="text-sm text-muted-foreground">Lembrete de renovação do contrato</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Segurança
              </CardTitle>
              <CardDescription>
                Configurações de segurança da plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Autenticação de Dois Fatores</Label>
                  <p className="text-sm text-muted-foreground">
                    Adicione uma camada extra de segurança
                  </p>
                </div>
                <Switch defaultChecked={false} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Log de Auditoria</Label>
                  <p className="text-sm text-muted-foreground">
                    Registrar todas as ações importantes
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Bloqueio por Tentativas</Label>
                  <p className="text-sm text-muted-foreground">
                    Bloquear usuário após tentativas de login falhas
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;