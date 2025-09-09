import { ReactNode } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Bot, Users, Shield, Settings, Home, LogOut, MessageSquare, User, Plus, Building2, History, Share2, UsersIcon, FileText, BarChart3, Database } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { hasPermission, getRoleLabel } from "@/lib/permissions";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { currentUser, logout, organization } = useApp();
  const location = useLocation();

  if (!currentUser) {
    return null;
  }

  const isSystemAdmin = currentUser?.email === 'dmarchezini@gmail.com';
  
  const navigationItems = [
    { name: "Dashboard", href: "/dashboard", icon: Home, show: true },
    { name: "Agentes", href: "/dashboard", icon: Bot, show: true },
    { name: "Templates", href: "/agents/templates", icon: Plus, show: true },
    { name: "Chat", href: "/agents/chat", icon: MessageSquare, show: hasPermission(currentUser?.role || 'member', "Usar agentes (interagir via chat)") },
    { name: "Histórico", href: "/chat/history", icon: History, show: hasPermission(currentUser?.role || 'member', "Ver histórico de conversas") },
    { name: "Compartilhar", href: "/agents/sharing", icon: Share2, show: hasPermission(currentUser?.role || 'member', "Compartilhar agentes") },
    { name: "Usuários", href: "/users", icon: Users, show: hasPermission(currentUser?.role || 'member', "Gerenciar usuários (convidar, editar, desativar)") },
    { name: "Grupos", href: "/user-groups", icon: UsersIcon, show: hasPermission(currentUser?.role || 'member', "Gerenciar grupos de usuários") },
    { name: "Auditoria", href: "/audit", icon: FileText, show: hasPermission(currentUser?.role || 'member', "Ver logs de auditoria") },
    { name: "Dashboard Executivo", href: "/executive-dashboard", icon: BarChart3, show: hasPermission(currentUser?.role || 'member', "Ver dashboard executivo") },
    { name: "Organização", href: "/organization", icon: Building2, show: hasPermission(currentUser?.role || 'member', "Gerenciar módulos e configurações da organização") },
    { name: "Permissões", href: "/permissions", icon: Shield, show: hasPermission(currentUser?.role || 'member', "Ver a tela de Papéis e Permissões") },
    { name: "Configurações", href: "/settings", icon: Settings, show: hasPermission(currentUser?.role || 'member', "Gerenciar módulos e configurações da organização") },
    { name: "System Admin", href: "/system-admin", icon: Database, show: isSystemAdmin }
  ];

  const visibleNavItems = navigationItems.filter(item => item.show);

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

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {visibleNavItems.map((item) => {
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
          </nav>

          {/* User Profile */}
          <div className="border-t p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 p-2 h-auto">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {currentUser.name.split(' ').map(n => n[0]).join('')}
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
          <ThemeToggle />
          <NotificationCenter />
        </header>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        <main className="min-h-[calc(100vh-4rem)] p-6 pt-20">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;