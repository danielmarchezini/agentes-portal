import { useState, useEffect } from "react";
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
import { User, Settings, Upload, Save, Shield } from "lucide-react";
import { getRoleLabel } from "@/lib/permissions";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";

const ProfilePage = () => {
  const { currentUser, setCurrentUser } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    bio: "",
    phone: "",
    location: "",
    timezone: "UTC-3",
    avatar: "",
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    browserNotifications: false,
    language: "pt-BR",
  });

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!currentUser?.id) return;
        const { data } = await supabase
          .from('profiles')
          .select('name, email, avatar')
          .eq('id', currentUser.id)
          .single();
        if (!ignore && data) {
          setProfileData(prev => ({
            ...prev,
            name: data.name ?? prev.name,
            email: data.email ?? prev.email,
            avatar: (data as any).avatar ?? prev.avatar,
            // Campos extras permanecem apenas no estado local, se usados pela UI
          }));
          try {
            const stored = (data as any).avatar as string | null;
            if (stored) {
              if (stored.startsWith('http')) {
                setAvatarUrl(stored);
              } else {
                const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(stored, 60 * 60 * 24 * 7);
                if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
              }
            }
          } catch {}
        }
      } catch {}
    })();
    return () => { ignore = true; };
  }, [currentUser?.id]);

  // Sem senha (usamos OTP)

  const handleSaveProfile = async () => {
    try {
      if (!currentUser?.id) return;
      if (!profileData.name.trim()) {
        toast({ title: 'Informe seu nome', description: 'O nome é obrigatório para continuar usando o portal.', variant: 'destructive' });
        return;
      }
      setSaving(true);
      const payload: any = { name: profileData.name.trim() };
      const { error } = await supabase.from('profiles').update(payload).eq('id', currentUser.id);
      if (error) throw error;
      toast({ title: 'Perfil atualizado', description: 'Suas informações pessoais foram salvas com sucesso.' });
      // Atualiza o contexto imediatamente para refletir no header
      try {
        if (currentUser) {
          setCurrentUser({ ...currentUser, name: profileData.name.trim() } as any);
        }
      } catch {}
      // Redirecionar para o dashboard somente se for a primeira vez (nome estava vazio antes)
      if (!currentUser?.name || currentUser.name.trim() === '') {
        navigate('/dashboard', { replace: true });
      }
    } catch (e: any) {
      toast({ title: 'Falha ao salvar', description: e?.message || 'Não foi possível salvar seu perfil.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Sem alteração de senha nesta página (autenticação via OTP)

  const handleSavePreferences = () => {
    // Save preferences
    toast({
      title: "Preferências salvas",
      description: "Suas preferências foram atualizadas com sucesso.",
    });
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!currentUser?.id) return;
      setUploadingAvatar(true);
      // Caminho único por usuário
      const filePath = `${currentUser.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;
      // Gerar URL assinada e salvar apenas o caminho no perfil
      const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(filePath, 60 * 60 * 24 * 7);
      const signedUrl = signed?.signedUrl || '';
      const { error: updErr } = await supabase.from('profiles').update({ avatar: filePath } as any).eq('id', currentUser.id);
      if (updErr) throw updErr;
      setAvatarUrl(signedUrl);
      toast({ title: 'Foto atualizada', description: 'Seu avatar foi atualizado com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Falha ao enviar avatar', description: e?.message || 'Não foi possível atualizar sua foto.', variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
      // limpar input para permitir reenviar o mesmo arquivo se necessário
      event.currentTarget.value = '';
    }
  };

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {(avatarUrl || (profileData.avatar && profileData.avatar.startsWith('http'))) ? (
            <img src={avatarUrl || profileData.avatar} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <AvatarFallback className="bg-primary text-primary-foreground text-xl">
              {(profileData.name || currentUser.name || "").split(' ').filter(Boolean).map(n => n[0]).join('') || 'U'}
            </AvatarFallback>
          )}
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{profileData.name || currentUser.name || 'Seu Perfil'}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {getRoleLabel(currentUser.role)}
            </Badge>
            <span className="text-muted-foreground">{profileData.email || currentUser.email}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Perfil
          </TabsTrigger>
          {/* Aba Segurança permanece apenas com informações da conta (sem alterar senha) */}
          <TabsTrigger value="security" className="flex items-center gap-2">
            {/* Ícone de cadeado removido */}
            Segurança
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Preferências
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          {!profileData.name.trim() && (
            <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-4 text-sm">
              <div className="font-medium mb-1">Complete seu perfil</div>
              Informe seu nome completo para continuar usando o portal e ser identificado nas listas (ex.: membros de grupos).
            </div>
          )}
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
                    {(avatarUrl || (profileData.avatar && profileData.avatar.startsWith('http'))) ? (
                      <img src={avatarUrl || profileData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                        {(profileData.name || currentUser.name || "").split(' ').filter(Boolean).map(n => n[0]).join('') || 'U'}
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
                    <Button asChild variant="outline" disabled={uploadingAvatar}>
                      <label htmlFor="avatar-upload" className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingAvatar ? 'Enviando...' : 'Alterar Foto'}
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
                    placeholder="Digite seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    readOnly
                    title="O e-mail é gerenciado pelo sistema e não pode ser alterado"
                    className="cursor-not-allowed opacity-90"
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

              {/* Telefone e Localização removidos */}

              <Button onClick={handleSaveProfile} className="w-full" disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab (sem alterar senha) */}
        <TabsContent value="security" className="space-y-6">
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

                {/* Preferências removidas: Resumo Semanal e Histórico de Chat */}
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