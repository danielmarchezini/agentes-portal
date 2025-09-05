import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Settings, Palette, Bot, Mail, Bell, Shield, Upload, TestTube, RefreshCw, Sun, Moon, Monitor, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { hexToHsl, hslToHex, resetBranding } from "@/lib/branding";

const SettingsPage = () => {
  const { currentUser, organization, setOrganization } = useApp();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  // State for all settings
  const [generalSettings, setGeneralSettings] = useState({
    orgName: organization?.name || "",
    domain: organization?.domain || "",
    timezone: "UTC-3",
    language: "pt-BR",
    autoBackup: true,
    maintenanceMode: false,
  });

  const [smtpSettings, setSmtpSettings] = useState({
    host: organization?.smtp?.host || "",
    port: organization?.smtp?.port || 587,
    username: organization?.smtp?.username || "",
    password: organization?.smtp?.password || "",
    fromEmail: "",
    encryption: "tls",
  });

  const [emailTemplates, setEmailTemplates] = useState({
    welcome: organization?.notifications?.emailTemplates?.welcome || "Bem-vindo ao AI Portal!",
    agentCreated: "Novo agente criado",
    userInvited: organization?.notifications?.emailTemplates?.invitation || "Você foi convidado",
  });

  const [brandingSettings, setBrandingSettings] = useState({
    logo: organization?.branding?.logo || "",
    primaryColor: organization?.branding?.colors?.primary || "224 71% 60%",
    secondaryColor: organization?.branding?.colors?.secondary || "220 14% 96%",
    accentColor: organization?.branding?.colors?.accent || "142 76% 36%",
  });

  const [llmSettings, setLlmSettings] = useState({
    openaiApiKey: localStorage.getItem('openai_api_key') || "",
    anthropicApiKey: localStorage.getItem('anthropic_api_key') || "",
    googleApiKey: localStorage.getItem('google_api_key') || "",
    perplexityApiKey: localStorage.getItem('perplexity_api_key') || "",
    defaultProvider: localStorage.getItem('default_llm_provider') || "openai",
    defaultModel: localStorage.getItem('default_llm_model') || "gpt-4",
    temperature: parseFloat(localStorage.getItem('llm_temperature') || "0.7"),
    maxTokens: parseInt(localStorage.getItem('llm_max_tokens') || "2048"),
  });

  const [showKeys, setShowKeys] = useState({
    openai: false,
    anthropic: false,
    google: false,
    perplexity: false,
  });

  // Check permissions
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
  }

  const handleSave = (section: string) => {
    toast({
      title: "Configurações salvas!",
      description: `As configurações de ${section} foram atualizadas com sucesso.`,
    });
  };

  const handleSaveSMTP = () => {
    if (organization) {
      setOrganization({
        ...organization,
        smtp: {
          host: smtpSettings.host,
          port: smtpSettings.port,
          secure: smtpSettings.encryption === "ssl",
          username: smtpSettings.username,
          password: smtpSettings.password,
        },
      });
    }
    toast({
      title: "SMTP configurado",
      description: "As configurações de e-mail foram salvas com sucesso.",
    });
  };

  const handleSaveTemplates = () => {
    if (organization) {
      setOrganization({
        ...organization,
        notifications: {
          ...organization.notifications,
          emailTemplates: {
            ...organization.notifications.emailTemplates,
            welcome: emailTemplates.welcome,
            invitation: emailTemplates.userInvited,
          },
        },
      });
    }
    toast({
      title: "Templates salvos",
      description: "Os templates de e-mail foram atualizados com sucesso.",
    });
  };

  const handleTestEmail = () => {
    // Simulate email testing
    toast({
      title: "E-mail de teste enviado",
      description: "Um e-mail de teste foi enviado com sucesso.",
    });
  };

  const handleSaveBranding = () => {
    if (organization) {
      setOrganization({
        ...organization,
        branding: {
          ...organization.branding,
          logo: brandingSettings.logo,
          colors: {
            primary: brandingSettings.primaryColor,
            secondary: brandingSettings.secondaryColor,
            accent: brandingSettings.accentColor,
          },
        },
      });
    }

    toast({
      title: "Marca atualizada",
      description: "As configurações de marca foram salvas com sucesso.",
    });
  };

  const handleResetBranding = () => {
    resetBranding();
    setBrandingSettings({
      logo: "",
      primaryColor: "224 71% 60%",
      secondaryColor: "220 14% 96%",
      accentColor: "142 76% 36%",
    });
    
    if (organization) {
      setOrganization({
        ...organization,
        branding: {
          logo: "",
          colors: {
            primary: "224 71% 60%",
            secondary: "220 14% 96%",
            accent: "142 76% 36%",
          },
        },
      });
    }

    toast({
      title: "Marca resetada",
      description: "As configurações foram restauradas para o padrão.",
    });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBrandingSettings({
          ...brandingSettings,
          logo: e.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveLLM = () => {
    // Save to localStorage for now
    localStorage.setItem('openai_api_key', llmSettings.openaiApiKey);
    localStorage.setItem('anthropic_api_key', llmSettings.anthropicApiKey);
    localStorage.setItem('google_api_key', llmSettings.googleApiKey);
    localStorage.setItem('perplexity_api_key', llmSettings.perplexityApiKey);
    localStorage.setItem('default_llm_provider', llmSettings.defaultProvider);
    localStorage.setItem('default_llm_model', llmSettings.defaultModel);
    localStorage.setItem('llm_temperature', llmSettings.temperature.toString());
    localStorage.setItem('llm_max_tokens', llmSettings.maxTokens.toString());

    toast({
      title: "Configurações de LLM salvas",
      description: "As chaves de API e configurações foram salvas localmente.",
    });
  };

  const llmProviders = {
    openai: {
      name: "OpenAI",
      models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-4o", "gpt-4o-mini"]
    },
    anthropic: {
      name: "Anthropic",
      models: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307", "claude-3-5-sonnet-20241022"]
    },
    google: {
      name: "Google",
      models: ["gemini-pro", "gemini-pro-vision", "gemini-1.5-pro", "gemini-1.5-flash"]
    },
    perplexity: {
      name: "Perplexity",
      models: ["llama-3.1-sonar-small-128k-online", "llama-3.1-sonar-large-128k-online", "llama-3.1-sonar-huge-128k-online"]
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações da sua organização
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Marca
          </TabsTrigger>
          <TabsTrigger value="llm" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            LLM
          </TabsTrigger>
          <TabsTrigger value="smtp" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            SMTP
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificações
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>
                Configurações básicas da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Nome da Organização</Label>
                  <Input
                    id="orgName"
                    value={generalSettings.orgName}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, orgName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domínio</Label>
                  <Input
                    id="domain"
                    value={generalSettings.domain}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, domain: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuso Horário</Label>
                  <Select value={generalSettings.timezone} onValueChange={(value) => setGeneralSettings(prev => ({ ...prev, timezone: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC-3">UTC-3 (Brasília)</SelectItem>
                      <SelectItem value="UTC-5">UTC-5 (Nova York)</SelectItem>
                      <SelectItem value="UTC+0">UTC+0 (Londres)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Idioma</Label>
                  <Select value={generalSettings.language} onValueChange={(value) => setGeneralSettings(prev => ({ ...prev, language: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tema da Interface</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="w-4 h-4" />
                          Claro
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="w-4 h-4" />
                          Escuro
                        </div>
                      </SelectItem>
                      <SelectItem value="system">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4" />
                          Sistema
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Backup Automático</Label>
                    <div className="text-sm text-muted-foreground">
                      Fazer backup dos dados automaticamente
                    </div>
                  </div>
                  <Switch
                    checked={generalSettings.autoBackup}
                    onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, autoBackup: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Modo Manutenção</Label>
                    <div className="text-sm text-muted-foreground">
                      Impedir acesso de usuários durante manutenção
                    </div>
                  </div>
                  <Switch
                    checked={generalSettings.maintenanceMode}
                    onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, maintenanceMode: checked }))}
                  />
                </div>
              </div>
              <Button onClick={() => handleSave("general")} className="w-full">
                Salvar Configurações Gerais
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Settings */}
        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Marca</CardTitle>
              <CardDescription>
                Personalize a aparência da sua organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Logo da Organização</Label>
                <div className="flex items-center gap-4">
                  {brandingSettings.logo && (
                    <div className="w-16 h-16 border rounded-lg overflow-hidden">
                      <img src={brandingSettings.logo} alt="Logo" className="w-full h-full object-contain" />
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
                        {brandingSettings.logo ? "Alterar Logo" : "Upload Logo"}
                      </label>
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Cor Primária</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={hslToHex(brandingSettings.primaryColor)}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, primaryColor: hexToHsl(e.target.value) }))}
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      value={brandingSettings.primaryColor}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                      placeholder="224 71% 60%"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor Secundária</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={hslToHex(brandingSettings.secondaryColor)}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, secondaryColor: hexToHsl(e.target.value) }))}
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      value={brandingSettings.secondaryColor}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      placeholder="220 14% 96%"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor de Destaque</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={hslToHex(brandingSettings.accentColor)}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, accentColor: hexToHsl(e.target.value) }))}
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      value={brandingSettings.accentColor}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                      placeholder="142 76% 36%"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              
              {/* Preview Section */}
              <div className="space-y-2">
                <Label>Pré-visualização</Label>
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex gap-2">
                    <Button className="bg-primary hover:bg-primary/90">Botão Primário</Button>
                    <Button variant="secondary">Botão Secundário</Button>
                    <Badge className="bg-accent text-accent-foreground">Tag de Destaque</Badge>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gradient-primary"></div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveBranding} className="flex-1">
                  Salvar Configurações de Marca
                </Button>
                <Button onClick={handleResetBranding} variant="outline" className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Resetar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LLM Settings */}
        <TabsContent value="llm" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de LLM</CardTitle>
              <CardDescription>
                Configure os provedores de IA e suas chaves de API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-800 dark:text-orange-200">Aviso de Segurança</p>
                    <p className="text-orange-700 dark:text-orange-300 mt-1">
                      As chaves de API estão sendo armazenadas localmente no navegador. Para uso em produção, 
                      recomendamos conectar ao Supabase para armazenamento seguro.
                    </p>
                  </div>
                </div>
              </div>

              {/* API Keys */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Chaves de API</h3>
                
                {/* OpenAI */}
                <div className="space-y-2">
                  <Label>OpenAI API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.openai ? "text" : "password"}
                      value={llmSettings.openaiApiKey}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                      placeholder="sk-..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, openai: !prev.openai }))}
                    >
                      {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Anthropic */}
                <div className="space-y-2">
                  <Label>Anthropic API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.anthropic ? "text" : "password"}
                      value={llmSettings.anthropicApiKey}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, anthropicApiKey: e.target.value }))}
                      placeholder="sk-ant-..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, anthropic: !prev.anthropic }))}
                    >
                      {showKeys.anthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Google */}
                <div className="space-y-2">
                  <Label>Google AI API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.google ? "text" : "password"}
                      value={llmSettings.googleApiKey}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, googleApiKey: e.target.value }))}
                      placeholder="AIza..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, google: !prev.google }))}
                    >
                      {showKeys.google ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Perplexity */}
                <div className="space-y-2">
                  <Label>Perplexity API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.perplexity ? "text" : "password"}
                      value={llmSettings.perplexityApiKey}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, perplexityApiKey: e.target.value }))}
                      placeholder="pplx-..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, perplexity: !prev.perplexity }))}
                    >
                      {showKeys.perplexity ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Default Provider and Model */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Configurações Padrão</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provedor Padrão</Label>
                    <Select
                      value={llmSettings.defaultProvider}
                      onValueChange={(value) => {
                        setLlmSettings(prev => ({ 
                          ...prev, 
                          defaultProvider: value,
                          defaultModel: llmProviders[value as keyof typeof llmProviders].models[0]
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(llmProviders).map(([key, provider]) => (
                          <SelectItem key={key} value={key}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo Padrão</Label>
                    <Select
                      value={llmSettings.defaultModel}
                      onValueChange={(value) => setLlmSettings(prev => ({ ...prev, defaultModel: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {llmProviders[llmSettings.defaultProvider as keyof typeof llmProviders]?.models.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Parameters */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Parâmetros</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Temperatura ({llmSettings.temperature})</Label>
                    <Input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={llmSettings.temperature}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground">
                      Controla a criatividade das respostas (0 = determinística, 2 = criativa)
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Máximo de Tokens</Label>
                    <Input
                      type="number"
                      min="1"
                      max="8192"
                      value={llmSettings.maxTokens}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 2048 }))}
                    />
                    <div className="text-xs text-muted-foreground">
                      Limite máximo de tokens na resposta
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveLLM} className="w-full">
                Salvar Configurações de LLM
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações SMTP</CardTitle>
              <CardDescription>
                Configure o envio de e-mails da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Servidor SMTP</Label>
                  <Input
                    value={smtpSettings.host}
                    onChange={(e) => setSmtpSettings(prev => ({ ...prev, host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Porta</Label>
                  <Input
                    type="number"
                    value={smtpSettings.port}
                    onChange={(e) => setSmtpSettings(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                    placeholder="587"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input
                    value={smtpSettings.username}
                    onChange={(e) => setSmtpSettings(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="seu-email@gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={smtpSettings.password}
                    onChange={(e) => setSmtpSettings(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="sua-senha"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveSMTP}>Salvar SMTP</Button>
                <Button onClick={handleTestEmail} variant="outline">
                  <TestTube className="w-4 h-4 mr-2" />
                  Testar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Templates de E-mail</CardTitle>
              <CardDescription>
                Configure os templates de e-mail da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template de Boas-vindas</Label>
                <Textarea
                  value={emailTemplates.welcome}
                  onChange={(e) => setEmailTemplates(prev => ({ ...prev, welcome: e.target.value }))}
                  placeholder="Bem-vindo ao sistema..."
                />
              </div>
              <div className="space-y-2">
                <Label>Template de Convite</Label>
                <Textarea
                  value={emailTemplates.userInvited}
                  onChange={(e) => setEmailTemplates(prev => ({ ...prev, userInvited: e.target.value }))}
                  placeholder="Você foi convidado para..."
                />
              </div>
              <Button onClick={handleSaveTemplates}>Salvar Templates</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notificações</CardTitle>
              <CardDescription>
                Configure as notificações do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Configurações de notificações serão implementadas em breve.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;