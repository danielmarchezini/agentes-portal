import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Settings, Upload, Save, Shield } from "lucide-react";
import { getRoleLabel } from "@/lib/permissions";

const ProfilePage = () => {
  const { currentUser } = useApp();
  const { toast } = useToast();

  const [profileData, setProfileData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    bio: "",
    phone: "",
    location: "",
    timezone: "UTC-3",
    avatar: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    browserNotifications: false,
    weeklyDigest: true,
    chatHistory: true,
    language: "pt-BR",
  });

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Acesso Negado</h3>
          <p className="text-muted-foreground">Você precisa estar logado para acessar o perfil.</p>
        </div>
      </div>
    );
  }

  const handleSaveProfile = () => {
    // Save profile changes
    toast({
      title: "Perfil atualizado",
      description: "Suas informações pessoais foram salvas com sucesso.",
    });
  };

  const handleChangePassword = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A nova senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    // Change password logic here
    toast({
      title: "Senha alterada",
      description: "Sua senha foi alterada com sucesso.",
    });

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handleSavePreferences = () => {
    // Save preferences
    toast({
      title: "Preferências salvas",
      description: "Suas preferências foram atualizadas com sucesso.",
    });
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileData({
          ...profileData,
          avatar: e.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {profileData.avatar ? (
            <img src={profileData.avatar} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <AvatarFallback className="bg-primary text-primary-foreground text-xl">
              {currentUser.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          )}
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{currentUser.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {getRoleLabel(currentUser.role)}
            </Badge>
            <span className="text-muted-foreground">{currentUser.email}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Preferências
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
              <CardDescription>
                Atualize suas informações pessoais e de contato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Foto do Perfil</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    {profileData.avatar ? (
                      <img src={profileData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                        {currentUser.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <Button asChild variant="outline">
                      <label htmlFor="avatar-upload" className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Alterar Foto
                      </label>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Biografia</Label>
                <Textarea
                  id="bio"
                  value={profileData.bio}
                  onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Conte um pouco sobre você..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Localização</Label>
                  <Input
                    id="location"
                    value={profileData.location}
                    onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="São Paulo, Brasil"
                  />
                </div>
              </div>

              <Button onClick={handleSaveProfile} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alterar Senha</CardTitle>
              <CardDescription>
                Mantenha sua conta segura alterando sua senha regularmente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Senha Atual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>

              <Button onClick={handleChangePassword} className="w-full">
                <Lock className="w-4 h-4 mr-2" />
                Alterar Senha
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações da Conta</CardTitle>
              <CardDescription>
                Detalhes sobre sua conta e permissões
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">ID do Usuário</Label>
                  <p className="text-sm text-muted-foreground font-mono">{currentUser.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Função</Label>
                  <Badge variant="secondary" className="mt-1">
                    {getRoleLabel(currentUser.role)}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Membro desde</Label>
                <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>
                Configure como você gostaria de receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notificações por E-mail</Label>
                    <p className="text-sm text-muted-foreground">Receber notificações importantes por e-mail</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.emailNotifications}
                    onChange={(e) => setPreferences(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                    className="rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notificações do Navegador</Label>
                    <p className="text-sm text-muted-foreground">Receber notificações push no navegador</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.browserNotifications}
                    onChange={(e) => setPreferences(prev => ({ ...prev, browserNotifications: e.target.checked }))}
                    className="rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Resumo Semanal</Label>
                    <p className="text-sm text-muted-foreground">Receber um resumo semanal das atividades</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.weeklyDigest}
                    onChange={(e) => setPreferences(prev => ({ ...prev, weeklyDigest: e.target.checked }))}
                    className="rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Histórico de Chat</Label>
                    <p className="text-sm text-muted-foreground">Salvar o histórico das conversas com agentes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.chatHistory}
                    onChange={(e) => setPreferences(prev => ({ ...prev, chatHistory: e.target.checked }))}
                    className="rounded"
                  />
                </div>
              </div>

              <Button onClick={handleSavePreferences} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Salvar Preferências
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfilePage;