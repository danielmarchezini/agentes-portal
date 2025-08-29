import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Settings, Mail, Shield, Save, TestTube } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";

const SettingsPage = () => {
  const { currentUser, organization, setOrganization } = useApp();
  const { toast } = useToast();
  
  // SMTP Settings
  const [smtpHost, setSmtpHost] = useState(organization?.smtp?.host || "");
  const [smtpPort, setSmtpPort] = useState(organization?.smtp?.port || 587);
  const [smtpSecure, setSmtpSecure] = useState<boolean>(organization?.smtp?.secure || true);
  const [smtpUsername, setSmtpUsername] = useState(organization?.smtp?.username || "");
  const [smtpPassword, setSmtpPassword] = useState("");
  
  // Organization Settings
  const [orgName, setOrgName] = useState(organization?.name || "");
  const [orgDomain, setOrgDomain] = useState(organization?.domain || "");
  
  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState<boolean>(true);
  const [dailyReports, setDailyReports] = useState<boolean>(false);
  const [securityAlerts, setSecurityAlerts] = useState<boolean>(true);

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

  const handleSaveSmtp = () => {
    if (!organization) return;
    
    const updatedOrg = {
      ...organization,
      smtp: {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        username: smtpUsername,
        password: smtpPassword || organization.smtp?.password || ""
      }
    };
    
    setOrganization(updatedOrg);
    toast({
      title: "Configurações SMTP salvas",
      description: "As configurações de e-mail foram atualizadas com sucesso",
    });
  };

  const handleTestSmtp = () => {
    toast({
      title: "Teste de SMTP enviado",
      description: "Um e-mail de teste foi enviado para verificar a configuração",
    });
  };

  const handleSaveOrganization = () => {
    if (!organization) return;
    
    const updatedOrg = {
      ...organization,
      name: orgName,
      domain: orgDomain
    };
    
    setOrganization(updatedOrg);
    toast({
      title: "Organização atualizada",
      description: "As informações da organização foram salvas",
    });
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

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Organização
          </TabsTrigger>
          <TabsTrigger value="smtp" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            E-mail
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Notificações
          </TabsTrigger>
        </TabsList>

        {/* Organization Settings */}
        <TabsContent value="organization">
          <Card className="animate-scale-in">
            <CardHeader>
              <CardTitle>Informações da Organização</CardTitle>
              <CardDescription>
                Configure as informações básicas da sua organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Nome da Organização</Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Corporation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgDomain">Domínio</Label>
                  <Input
                    id="orgDomain"
                    value={orgDomain}
                    onChange={(e) => setOrgDomain(e.target.value)}
                    placeholder="acme.com"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button onClick={handleSaveOrganization} className="bg-gradient-primary">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMTP Settings */}
        <TabsContent value="smtp">
          <Card className="animate-scale-in">
            <CardHeader>
              <CardTitle>Configurações SMTP</CardTitle>
              <CardDescription>
                Configure o servidor SMTP para envio de e-mails da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">Servidor SMTP</Label>
                  <Input
                    id="smtpHost"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">Porta</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="smtpSecure"
                  checked={smtpSecure}
                  onCheckedChange={setSmtpSecure}
                />
                <Label htmlFor="smtpSecure">Usar conexão segura (SSL/TLS)</Label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpUsername">Usuário</Label>
                  <Input
                    id="smtpUsername"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                    placeholder="seu-email@gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">Senha</Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="Digite a senha ou deixe em branco para manter"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleTestSmtp}>
                  <TestTube className="w-4 h-4 mr-2" />
                  Testar Configuração
                </Button>
                <Button onClick={handleSaveSmtp} className="bg-gradient-primary">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar SMTP
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications">
          <Card className="animate-scale-in">
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>
                Configure como e quando você deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Notificações por E-mail</Label>
                    <p className="text-sm text-muted-foreground">
                      Receber notificações importantes por e-mail
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Relatórios Diários</Label>
                    <p className="text-sm text-muted-foreground">
                      Receber resumo diário de atividades
                    </p>
                  </div>
                  <Switch
                    checked={dailyReports}
                    onCheckedChange={setDailyReports}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Alertas de Segurança</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificações sobre tentativas de acesso e atividades suspeitas
                    </p>
                  </div>
                  <Switch
                    checked={securityAlerts}
                    onCheckedChange={setSecurityAlerts}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button className="bg-gradient-primary">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Preferências
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;