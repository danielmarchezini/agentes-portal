import { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bot, Plus, Search, Filter, MessageSquare, Users, BarChart, Globe, Heart } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/hooks/use-permissions";
import { hasPermission } from "@/lib/permissions";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { currentUser, agents, setAgents, organization, supportMode } = useApp();
  const { isSystemAdmin } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [onlyPublic, setOnlyPublic] = useState<boolean>(() => {
    try { return localStorage.getItem('dashboard_only_public') === '1'; } catch { return false; }
  });

  // Resumo: contagens reais
  const totalAgents = agents.length;
  const publicCount = agents.filter((a: any) => (a as any).isPublic).length;
  const favoritesCount = agents.filter((a: any) => (a as any).isFavorite).length;
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Publica um agente existente como template do marketplace da organização
  const publishToOrgMarketplace = async (agent: any) => {
    try {
      if (!organization?.id || !currentUser?.id) return;
      // Checagem anti-duplicação: já existe template desta org para este agente?
      const { data: existsOrg, error: existErr } = await supabase
        .from('agent_templates')
        .select('id')
        .eq('visibility', 'org')
        .eq('organization_id', organization.id)
        .contains('config', { source_agent_id: agent.id })
        .limit(1)
        .maybeSingle();
      if (!existErr && existsOrg) {
        toast({ title: 'Já publicado', description: 'Este agente já possui um template no Marketplace da Empresa.' });
        return;
      }
      const payload = {
        title: agent.name,
        description: agent.description || null,
        category: agent.category || null,
        tags: Array.isArray(agent.tags) ? agent.tags : [],
        visibility: 'org',
        organization_id: organization.id,
        owner_id: null,
        author_id: currentUser.id,
        config: {
          source_agent_id: agent.id,
          mode: agent.mode || 'custom',
          model: agent.model || null,
          system_prompt: agent.systemPrompt || '',
          allow_file_uploads: !!agent.allow_file_uploads,
          file_storage_mode: agent.file_storage_mode || null,
          retention_limit: agent.retention_limit ?? null,
          retention_days: agent.retention_days ?? null,
          generation_provider: (agent as any).generation_provider || null,
          embedding_provider: (agent as any).embedding_provider || null,
          embedding_model: (agent as any).embedding_model || null,
          assistant_provider: agent.assistant_provider || null,
          assistant_id: agent.assistant_id || null,
          tags: Array.isArray(agent.tags) ? agent.tags : []
        }
      } as any;
      const { error } = await supabase.from('agent_templates').insert(payload);
      if (error) throw error;
      toast({ title: 'Publicado no Marketplace da Empresa', description: 'O template foi criado para sua organização.' });
    } catch (e: any) {
      toast({ title: 'Falha ao publicar', description: e?.message || 'Tente novamente mais tarde.', variant: 'destructive' });
    }
  };

  // Publica como Global (OWNER/Admin/Gestor de Bot)
  const publishAsGlobal = async (agent: any) => {
    try {
      if (!currentUser?.id) return;
      // Checagem anti-duplicação: já existe template global para este agente?
      const { data: existsGlobal, error: existErr } = await supabase
        .from('agent_templates')
        .select('id')
        .eq('visibility', 'global')
        .contains('config', { source_agent_id: agent.id })
        .limit(1)
        .maybeSingle();
      if (!existErr && existsGlobal) {
        toast({ title: 'Já publicado (Global)', description: 'Já existe um template Global para este agente.' });
        return;
      }
      const payload = {
        title: agent.name,
        description: agent.description || null,
        category: agent.category || null,
        tags: Array.isArray(agent.tags) ? agent.tags : [],
        visibility: 'global',
        organization_id: null,
        owner_id: null,
        author_id: currentUser.id,
        config: {
          source_agent_id: agent.id,
          mode: agent.mode || 'custom',
          model: agent.model || null,
          system_prompt: agent.systemPrompt || '',
          allow_file_uploads: !!agent.allow_file_uploads,
          file_storage_mode: agent.file_storage_mode || null,
          retention_limit: agent.retention_limit ?? null,
          retention_days: agent.retention_days ?? null,
          generation_provider: (agent as any).generation_provider || null,
          embedding_provider: (agent as any).embedding_provider || null,
          embedding_model: (agent as any).embedding_model || null,
          assistant_provider: agent.assistant_provider || null,
          assistant_id: agent.assistant_id || null,
          tags: Array.isArray(agent.tags) ? agent.tags : []
        }
      } as any;
      const { error } = await supabase.from('agent_templates').insert(payload);
      if (error) throw error;
      toast({ title: 'Publicado como Global', description: 'O template global foi criado.' });
    } catch (e: any) {
      toast({ title: 'Falha ao publicar global', description: e?.message || 'Tente novamente mais tarde.', variant: 'destructive' });
    }
  };
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestStep, setRequestStep] = useState<'pre'|'form'>('pre');
  const [reqArea, setReqArea] = useState("");
  const [reqDescription, setReqDescription] = useState("");
  const [reqPublic, setReqPublic] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);
  const { toast } = useToast();
  const [reqFiles, setReqFiles] = useState<File[]>([]);
  const [reqDate] = useState<string>(new Date().toLocaleString('pt-BR'));
  const [loadingAgents, setLoadingAgents] = useState(false);
  const reloadTimer = useRef<number | null>(null);
  const bgReloadRequested = useRef<boolean>(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");

  // Carregamento dos agentes (pode ser reutilizado em eventos)
  const loadAgents = useCallback(async () => {
    if (!organization?.id) return;
    try {
      const prevScrollY = window.scrollY;
      setLoadingAgents(true);
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        // Carrega favoritos do usuário para esta organização
        let favSet = new Set<string>();
        try {
          if (currentUser?.id) {
            const { data: favs } = await supabase
              .from('agent_favorites')
              .select('agent_id')
              .eq('user_id', currentUser.id)
              .eq('organization_id', organization.id);
            favSet = new Set<string>((favs || []).map((f: any) => f.agent_id));
            setFavoriteIds(favSet);
          }
        } catch {}
        const { data: pubShares } = await supabase
          .from('agent_shares')
          .select('agent_id')
          .eq('organization_id', organization.id)
          .eq('target_type', 'public');
        const publicSet = new Set<string>((pubShares || []).map((s: any) => s.agent_id));

        // Busca templates publicados da organização para sinalizar 'Publicado'
        const { data: orgTemplates } = await supabase
          .from('agent_templates')
          .select('config')
          .eq('visibility', 'org')
          .eq('organization_id', organization.id);
        const publishedSet = new Set<string>(
          (orgTemplates || [])
            .map((t: any) => (t?.config?.source_agent_id as string) || null)
            .filter(Boolean)
        );
        const mapped = data.map((a: any) => ({
          id: a.id,
          name: a.name,
          slug: a.slug,
          description: a.description,
          category: a.category,
          model: a.model,
          systemPrompt: a.system_prompt,
          status: a.status || 'active',
          createdBy: a.created_by,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
          version: a.version || 1,
          usageCount: a.usage_count || 0,
          tags: Array.isArray(a.tags) ? a.tags : (a.tags || []),
          mode: a.mode,
          assistant_provider: a.assistant_provider,
          assistant_id: a.assistant_id,
          retention_limit: a.retention_limit,
          retention_days: a.retention_days,
          allow_file_uploads: a.allow_file_uploads,
          file_storage_mode: a.file_storage_mode,
          vector_store_id: a.vector_store_id,
          isPublic: publicSet.has(a.id),
          hasOrgTemplate: publishedSet.has(a.id),
          isFavorite: favSet.has(a.id),
        }));
        setAgents(mapped as any);
        // Se foi reload em background, mostra toast e preserva posição de scroll
        if (bgReloadRequested.current) {
          toast({ title: 'Lista atualizada', description: 'As informações de agentes foram recarregadas.' });
          bgReloadRequested.current = false;
          // Restaura scroll na próxima pintura
          window.requestAnimationFrame(() => window.scrollTo({ top: prevScrollY }));
        }
        setLastUpdatedAt(new Date().toLocaleTimeString('pt-BR'));
      }
    } catch {}
    finally {
      setLoadingAgents(false);
    }
  }, [organization?.id, setAgents]);

  // Refetch ao montar e quando org mudar
  useEffect(() => { loadAgents(); }, [loadAgents]);

  // Persiste preferência do filtro 'Somente públicos'
  useEffect(() => {
    try { localStorage.setItem('dashboard_only_public', onlyPublic ? '1' : '0'); } catch {}
  }, [onlyPublic]);

  // Auto-reload quando voltar o foco ou aba ficar visível novamente
  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      reloadTimer.current = window.setTimeout(() => {
        loadAgents();
      }, 300);
    };
    const onFocus = () => { bgReloadRequested.current = true; scheduleReload(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') { bgReloadRequested.current = true; scheduleReload(); }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    };
  }, [loadAgents]);

  if (!currentUser) return null;
  const sysAdmin = isSystemAdmin();
  const canSeeAdminSummary = sysAdmin || currentUser.role === 'owner' || currentUser.role === 'admin';

  const categories = ["all", "Análise", "Criatividade", "Suporte"];
  
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || agent.category === selectedCategory;
    const matchesPublic = !onlyPublic || (agent as any).isPublic;
    return matchesSearch && matchesCategory && matchesPublic;
  });

  // Ordena favoritos no topo
  const sortedAgents = [...filteredAgents].sort((a: any, b: any) => {
    const af = (a as any).isFavorite ? 1 : 0;
    const bf = (b as any).isFavorite ? 1 : 0;
    if (bf !== af) return bf - af; // favoritos primeiro
    return String(a.name).localeCompare(String(b.name));
  });

  const toggleFavorite = async (agentId: string) => {
    if (!currentUser?.id || !organization?.id) return;
    const isFav = favoriteIds.has(agentId);
    // Otimista
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(agentId); else next.add(agentId);
      return next;
    });
    // Atualiza lista local (isFavorite)
    setAgents(agents.map((a: any) => a.id === agentId ? { ...a, isFavorite: !isFav } : a) as any);
    try {
      if (isFav) {
        await supabase.from('agent_favorites')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('organization_id', organization.id)
          .eq('agent_id', agentId);
      } else {
        await supabase.from('agent_favorites')
          .insert({ user_id: currentUser.id, organization_id: organization.id, agent_id: agentId } as any);
      }
    } catch {
      // Reverte se falhar
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(agentId); else next.delete(agentId);
        return next;
      });
      setAgents(agents.map((a: any) => a.id === agentId ? { ...a, isFavorite: isFav } : a) as any);
    }
  };

  const canCreateAgent = hasPermission(currentUser.role, "Criar um novo agente");
  const canViewRequests = hasPermission(currentUser.role, "Ver solicitações de agentes");

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'inactive': return 'bg-muted text-muted-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Onboarding quando não há organização associada ao perfil
  if (!organization) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo ao AI Portal</CardTitle>
            <CardDescription>
              Seu usuário ainda não está associado a uma organização.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sysAdmin ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Como administrador do sistema, você pode criar uma organização agora.
                </p>
                <Button asChild className="bg-gradient-primary hover:bg-primary-hover shadow-primary">
                  <Link to="/system-admin">Ir para System Admin</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Solicite a um administrador que associe você a uma organização ou envie seu e-mail corporativo permitido.
                </p>
                <Button asChild variant="outline">
                  <Link to="/">Voltar ao Login</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:space-y-3 animate-fade-in w-full px-4 md:px-8">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard de Agentes</h1>
            {loadingAgents && (
              <Badge variant="outline" className="ml-1 flex items-center gap-2 text-[11px]">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Atualizando…
              </Badge>
            )}
            {organization?.name && (
              <Badge variant={supportMode ? 'secondary' : 'outline'}>
                {supportMode ? 'Suporte' : 'Org'}: {organization.name}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
            <p>Gerencie e interaja com os agentes de IA da sua organização</p>
            {agents.length > 0 && (
              <>
                <span className="text-xs">• Públicos: <span className="font-medium">{agents.filter((a: any) => a.isPublic).length}</span></span>
                <span className="text-xs">Privados: <span className="font-medium">{agents.length - agents.filter((a: any) => a.isPublic).length}</span></span>
                {lastUpdatedAt && <span className="text-xs">• Última atualização: {lastUpdatedAt}</span>}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadAgents()} disabled={loadingAgents}>
            {loadingAgents ? 'Atualizando…' : 'Atualizar'}
          </Button>
          {canCreateAgent ? (
            <Button asChild className="bg-gradient-primary hover:bg-primary-hover shadow-primary">
              <Link to="/agents/new">
                <Plus className="w-4 h-4 mr-2" />
                Criar Novo Agente
              </Link>
            </Button>
          ) : (
            <div className="flex gap-2">
              <Dialog open={requestOpen} onOpenChange={(open) => { setRequestOpen(open); if (!open) { setRequestStep('pre'); } }}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-primary hover:bg-primary-hover shadow-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Solicitar novo agente
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  {requestStep === 'pre' ? (
                    <>
                      <DialogHeader>
                        <DialogTitle>Atenção</DialogTitle>
                        <DialogDescription>
                          Você está solicitando a criação de um novo agente. Antes, verifique se ele já existe no Marketplace da empresa.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" asChild>
                          <Link to="/marketplace">Visitar Marketplace</Link>
                        </Button>
                        <Button onClick={() => setRequestStep('form')} className="bg-gradient-primary">Continuar</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <DialogHeader>
                        <DialogTitle>Solicitar criação de agente</DialogTitle>
                        <DialogDescription>Preencha os detalhes para o gestor avaliar e criar o agente.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="grid gap-2">
                          <Label>Seu nome</Label>
                          <Input value={currentUser.name} readOnly className="cursor-not-allowed opacity-90" />
                        </div>
                        <div className="grid gap-2">
                          <Label>Data da solicitação</Label>
                          <Input value={reqDate} readOnly className="cursor-not-allowed opacity-90" />
                        </div>
                        <div className="grid gap-2">
                          <Label>Para qual área</Label>
                          <Input value={reqArea} onChange={(e) => setReqArea(e.target.value)} placeholder="Ex.: Suporte, Financeiro, Marketing" />
                        </div>
                        <div className="grid gap-2">
                          <Label>Descrição do agente</Label>
                          <Textarea value={reqDescription} onChange={(e) => setReqDescription(e.target.value)} placeholder="Explique para que serve o agente e como ele deve ajudar" rows={4} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Anexos (opcional)</Label>
                          <Input type="file" multiple onChange={(e) => setReqFiles(Array.from(e.target.files || []))} />
                          {reqFiles.length > 0 && (
                            <div className="text-xs text-muted-foreground">{reqFiles.length} arquivo(s) selecionado(s)</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input id="req-public" type="checkbox" checked={reqPublic} onChange={(e) => setReqPublic(e.target.checked)} />
                          <Label htmlFor="req-public">Agente público (disponível para todos na organização)</Label>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancelar</Button>
                          <Button disabled={reqLoading} onClick={async () => {
                            try {
                              if (!organization?.id || !currentUser?.id) return;
                              if (!reqArea.trim()) { toast({ title: 'Campo obrigatório', description: 'Informe para qual área o agente será usado.', variant: 'destructive' }); return; }
                              if (!reqDescription.trim()) { toast({ title: 'Campo obrigatório', description: 'Descreva o propósito do agente.', variant: 'destructive' }); return; }
                              setReqLoading(true);
                              const { data: created, error: insErr } = await supabase.from('agent_requests').insert({
                                organization_id: organization.id,
                                requester_id: currentUser.id,
                                requester_name: currentUser.name,
                                area: reqArea.trim(),
                                description: reqDescription.trim(),
                                is_public: reqPublic,
                                requested_at: new Date().toISOString(),
                              } as any).select('*').single();
                              if (insErr) throw insErr;
                              let attachments: Array<{ path: string; name: string; size: number }> = [];
                              if (reqFiles.length > 0) {
                                for (const file of reqFiles) {
                                  const path = `${organization.id}/${created.id}/${file.name}`;
                                  const { error: upErr } = await supabase.storage.from('agent-request-files').upload(path, file, { upsert: true });
                                  if (upErr) { toast({ title: 'Falha no upload', description: upErr.message, variant: 'destructive' }); continue; }
                                  attachments.push({ path, name: file.name, size: file.size });
                                }
                              }
                              if (attachments.length > 0) {
                                const { error: updErr } = await supabase.from('agent_requests').update({ attachments } as any).eq('id', created.id);
                                if (updErr) throw updErr;
                              }
                              setRequestOpen(false);
                              setRequestStep('pre');
                              setReqArea(""); setReqDescription(""); setReqPublic(false);
                              setReqFiles([]);
                              toast({ title: 'Solicitação enviada', description: 'Seu pedido foi registrado e será avaliado pelo Especialista em IA.' });
                            } catch (e: any) {
                              toast({ title: 'Erro ao enviar', description: e?.message || 'Tente novamente mais tarde.', variant: 'destructive' });
                            } finally {
                              setReqLoading(false);
                            }
                          }}>Enviar solicitação</Button>
                        </div>
                      </div>
                    </>
                  )}
                </DialogContent>
              </Dialog>
              {canViewRequests && (
                <Button asChild variant="outline">
                  <Link to="/agents/requests">Ver solicitações</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resumo dos seus agentes (compacto) - somente admins/owners */}
      {canSeeAdminSummary && (
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="animate-scale-in" style={{ animationDelay: '0.0s' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de agentes</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAgents}</div>
            </CardContent>
          </Card>
          <Card className="animate-scale-in" style={{ animationDelay: '0.05s' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Públicos</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{publicCount}</div>
            </CardContent>
          </Card>
          <Card className="animate-scale-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Favoritos</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{favoritesCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Guia rápido - somente admins/owners */}
      {canSeeAdminSummary && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Guia rápido</CardTitle>
            <CardDescription>Atalhos úteis</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="bg-gradient-primary hover:bg-primary-hover">
              <Link to="/agents/new"><Plus className="w-4 h-4 mr-2" />Criar agente</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/settings/integrations/external-actions">Integrações</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/agents/requests">Solicitações</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/marketplace">Marketplace</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filtros (espaçamento compacto) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar agentes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={selectedCategory === category ? "bg-gradient-primary" : ""}
            >
              {category === "all" ? "Todos" : category}
            </Button>
          ))}
          <label className="flex items-center gap-2 text-sm ml-2">
            <input type="checkbox" checked={onlyPublic} onChange={(e) => setOnlyPublic(e.target.checked)} />
            Somente públicos
          </label>
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-muted-foreground">Presets:</span>
            {categories.filter((c) => c !== 'all').map((cat) => (
              <Button
                key={`pub-${cat}`}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => { setSelectedCategory(cat); setOnlyPublic(true); }}
                title={`Mostrar ${cat} públicos`}
              >
                <Globe className="w-3.5 h-3.5 mr-1" /> {cat}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedAgents.map((agent: any, index) => (
          <Card 
            key={agent.id} 
            className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer animate-scale-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-primary rounded-lg shadow-primary">
                    <Bot className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {(agent as any).isPublic ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-2">
                                {agent.name}
                                <Globe className="w-4 h-4 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Visível para toda a organização</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <>{agent.name}</>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{agent.category}</Badge>
                      {(agent as any).hasOrgTemplate && (
                        <Badge variant="outline" className="text-[11px]">Publicado</Badge>
                      )}
                      {!((agent as any).isPublic) && !((agent as any).hasOrgTemplate) && (
                        <Badge variant="outline" className="text-[11px]">Não publicado</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleFavorite(agent.id)}
                    title={agent.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  >
                    <Heart className={agent.isFavorite ? 'w-5 h-5 text-red-500 fill-red-500' : 'w-5 h-5 text-muted-foreground'} />
                  </Button>
                  <Badge className={getStatusColor(agent.status)}>
                    {agent.status === 'active' ? 'Ativo' : 
                     agent.status === 'inactive' ? 'Inativo' : 'Pendente'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                {agent.description}
              </CardDescription>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  {agent.usageCount} usos
                </div>
                <div className="flex items-center gap-1">
                  <BarChart className="w-4 h-4" />
                  v{agent.version}
                </div>
                {agent.isPublic && (
                  <Badge variant="outline" className="text-[11px]">
                    Público
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {agent.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {agent.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{agent.tags.length - 3}
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  asChild
                  size="sm" 
                  className="flex-1 bg-gradient-primary hover:bg-primary-hover"
                >
                  <Link to={`/agents/chat/${agent.slug || agent.id}`}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Chat
                  </Link>
                </Button>
                {hasPermission(currentUser.role, "Editar a configuração de um agente") && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/agents/edit/${agent.slug || agent.id}`}>
                      Configurar
                    </Link>
                  </Button>
                )}
                {canSeeAdminSummary && hasPermission(currentUser.role, "Editar a configuração de um agente") && (
                  <Button variant="outline" size="sm" onClick={() => publishToOrgMarketplace(agent)}>
                    Publicar
                  </Button>
                )}
                {canSeeAdminSummary && (isSystemAdmin() || currentUser.role === 'admin' || hasPermission(currentUser.role, "Editar a configuração de um agente")) && (
                  <Button variant="outline" size="sm" onClick={() => publishAsGlobal(agent)}>
                    Global
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAgents.length === 0 && (
        <div className="text-center py-12">
          <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum agente encontrado</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || selectedCategory !== "all" 
              ? "Tente ajustar os filtros de busca"
              : "Comece criando seu primeiro agente de IA"
            }
          </p>
          {canCreateAgent && !searchTerm && selectedCategory === "all" && (
            <Button asChild className="bg-gradient-primary hover:bg-primary-hover shadow-primary">
              <Link to="/agents/new">
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Agente
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;