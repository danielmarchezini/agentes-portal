import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Bot, Users, Shield, Settings, Home, LogOut, MessageSquare, User, Plus, Building2, History, Share2, UsersIcon, FileText, BarChart3, Database, ChevronDown, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { hasPermission, getRoleLabel } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { currentUser, logout, organization, supportMode, enterSupportOrg, exitSupportMode } = useApp();
  const { isSystemAdmin, checkingOwner } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [orgOptions, setOrgOptions] = useState<{ id: string; name: string }[]>([]);
  const [orgLoadError, setOrgLoadError] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState<string>("");

  // Persistência do estado de seções abertas da sidebar
  const SECTIONS_STORAGE_KEY = 'sidebar:sections';

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadOrgs = async () => {
      try {
        if (!currentUser) return;
        if (checkingOwner) return;
        // Para owners globais, RPC retorna todas; senão, retorna apenas a org do usuário
        const { data, error } = await supabase.rpc('list_organizations_for_header');
        if (error) {
          setOrgLoadError(error.message || 'Falha ao carregar organizações');
          setOrgOptions([]);
          return;
        }
        setOrgLoadError(null);
        setOrgOptions(((data as any[]) || []).map((o: any) => ({ id: o.id, name: o.name })));
      } catch (e: any) {
        setOrgLoadError(String(e?.message || 'Erro inesperado'));
        setOrgOptions([]);
      }
    };
    loadOrgs();
  }, [currentUser?.id, checkingOwner]);

  useEffect(() => {
    // carrega estado das seções
    try {
      const raw = localStorage.getItem(SECTIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setOpenSections(parsed);
      }
    } catch {}
  }, []);

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
      const next = { ...prev, [title]: !prev[title] };
      try { localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-surface">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p>Carregando seu perfil...</p>
        </div>
      </div>
    );
  }

  // Seções do menu (agrupadas por tema)
  const navigationSections: Array<{
    title: string;
    items: Array<{ name: string; href: string; icon: any; show: boolean }>;
  }> = [
    {
      title: "Explorar",
      items: [
        { name: "Marketplace", href: "/marketplace", icon: Plus, show: true },
        { name: "Chat", href: "/agents/chat", icon: MessageSquare, show: hasPermission(currentUser?.role || 'member', "Usar agentes (interagir via chat)") },
      ]
    },
    {
      title: "Gestão de Agentes",
      items: [
        { name: "Solicitações", href: "/agents/requests", icon: Users, show: hasPermission(currentUser?.role || 'member', "Ver solicitações de agentes") },
        { name: "Compartilhar", href: "/agents/sharing", icon: Share2, show: hasPermission(currentUser?.role || 'member', "Compartilhar agentes") },
      ]
    },
    {
      title: "Histórico e Auditoria",
      items: [
        { name: "Histórico", href: "/chat/history", icon: History, show: hasPermission(currentUser?.role || 'member', "Ver histórico de conversas") },
        { name: "Auditoria", href: "/audit", icon: FileText, show: hasPermission(currentUser?.role || 'member', "Ver logs de auditoria") },
      ]
    },
    {
      title: "Organização",
      items: [
        { name: "Usuários", href: "/users", icon: Users, show: hasPermission(currentUser?.role || 'member', "Gerenciar usuários (convidar, editar, desativar)") },
        { name: "Grupos", href: "/user-groups", icon: UsersIcon, show: hasPermission(currentUser?.role || 'member', "Gerenciar grupos de usuários") },
        { name: "Organização", href: "/organization", icon: Building2, show: hasPermission(currentUser?.role || 'member', "Gerenciar módulos e configurações da organização") },
        { name: "Permissões", href: "/permissions", icon: Shield, show: hasPermission(currentUser?.role || 'member', "Ver a tela de Papéis e Permissões") },
        { name: "Configurações", href: "/settings", icon: Settings, show: hasPermission(currentUser?.role || 'member', "Gerenciar módulos e configurações da organização") },
      ]
    },
    {
      title: "Painéis",
      items: [
        { name: "Dashboard Executivo", href: "/executive-dashboard", icon: BarChart3, show: hasPermission(currentUser?.role || 'member', "Ver dashboard executivo") },
      ]
    },
    {
      title: "Sistema",
      items: [
        { name: "System Admin", href: "/system-admin", icon: Database, show: isSystemAdmin() },
        { name: "Owner Templates", href: "/owner/templates", icon: Database, show: isSystemAdmin() },
        { name: "Manual", href: "/manual", icon: FileText, show: hasPermission(currentUser?.role || 'member', "Ver Manual") },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-background border-r shadow-elegant">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center border-b px-6">
            <div className="flex items-center gap-3">
              {organization?.branding?.logo ? (
                <div className="w-10 h-10 bg-gradient-primary rounded-lg shadow-primary overflow-hidden">
                  <img 
                    src={organization.branding.logo} 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="p-2 bg-gradient-primary rounded-lg shadow-primary">
                  <Bot className="w-6 h-6 text-primary-foreground" />
                </div>
              )}
              <div>
                <h2 className="font-bold text-lg">AI Portal</h2>
                <p className="text-sm text-muted-foreground">Gestão de IA</p>
              </div>
            </div>
          </div>

          {/* Organização ativa (sidebar) */}
          {organization?.name && (
            <div className="px-6 py-2 border-b">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Badge variant="outline" className="w-full justify-center">Org atual: {organization.name}</Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Organização em que você está operando no momento.</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Link isolado: Dashboard (sempre visível) */}
          <div className="p-4 pt-3">
            {(() => {
              const isActive = location.pathname === '/dashboard';
              return (
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Home className="h-5 w-5" />
                  Dashboard
                </Link>
              );
            })()}
          </div>

          {/* Navigation (agrupada por seção) */}
          <nav className="flex-1 px-4 pb-4 space-y-3">
            {navigationSections.map((section) => {
              const items = section.items.filter(i => i.show);
              if (items.length === 0) return null;
              const isOpen = openSections[section.title] ?? false;
              return (
                <div key={section.title} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] uppercase tracking-wide text-muted-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <span>{section.title}</span>
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {isOpen && (
                    <div className="space-y-1">
                      {items.map((item) => {
                        const isActive = location.pathname === item.href;
                        const Icon = item.icon;
                        return (
                          <Link
                            key={`${item.href}-${item.name}`}
                            to={item.href}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                              isActive
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="border-t p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 p-2 h-auto">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {((currentUser.name || currentUser.email || '')
                        .split(' ')
                        .map((n) => n?.[0] || '')
                        .join('')
                        .slice(0, 2)) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground">{getRoleLabel(currentUser.role)}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Header */}
      <div className="pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-4 border-b bg-background/95 backdrop-blur px-6">
          {/* Organização ativa (fora do modo suporte) */}
          {!supportMode && organization?.name && (
            <div className="mr-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Badge variant="outline">Org atual: {organization.name}</Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Organização em que você está operando no momento.</TooltipContent>
              </Tooltip>
            </div>
          )}
          {/* Modo Suporte: seletor de organizações e indicador */}
          {isSystemAdmin() && (
            <div className="flex items-center gap-3 mr-auto">
              <div className="hidden md:flex items-center gap-2">
                {supportMode && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Badge variant="secondary">Suporte: {organization?.name || '—'}</Badge>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Você está visualizando/operando como suporte nesta organização. Clique em Sair para retornar.</TooltipContent>
                  </Tooltip>
                )}
                <Select onValueChange={async (val) => {
                  await enterSupportOrg(val);
                  toast({ title: 'Organização alterada', description: 'Modo Suporte: agora visualizando a organização selecionada.' });
                  navigate('/dashboard');
                }}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder={supportMode ? 'Trocar de organização…' : 'Entrar como (suporte)…'} />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input
                        placeholder="Buscar organização..."
                        value={orgFilter}
                        onChange={(e) => setOrgFilter(e.target.value)}
                      />
                    </div>
                    {orgLoadError && (
                      <SelectItem value="__error" disabled>{orgLoadError}</SelectItem>
                    )}
                    {!orgLoadError && orgOptions.length === 0 && (
                      <SelectItem value="__empty" disabled>Nenhuma organização disponível</SelectItem>
                    )}
                    {!orgLoadError && orgOptions
                      .filter((o) => o.name.toLowerCase().includes(orgFilter.toLowerCase()))
                      .map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {supportMode && (
                  <Button size="sm" variant="outline" onClick={exitSupportMode}>Sair</Button>
                )}
              </div>
            </div>
          )}

          {/* Badge para Owner Global (sem organização vinculada) com tooltip e atalho */}
          {currentUser.role === 'owner' && !organization && (
            <div className="flex items-center gap-2 mr-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Badge variant="secondary">⭐ Owner (global)</Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Conta com acesso total. Não vinculada a nenhuma organização.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Link to="/system-admin" className="text-xs underline text-muted-foreground hover:text-foreground">System Owners</Link>
              <Link to="/system-admin?new=1">
                <Button size="sm" className="bg-gradient-primary">Nova Organização</Button>
              </Link>
            </div>
          )}
          <ThemeToggle />
          <NotificationCenter />
        </header>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        <main className="min-h-[calc(100vh-4rem)] p-6 pt-8 md:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;