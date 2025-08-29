import React from 'react';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Bot, Users, Shield, Settings, MessageSquare, LogOut } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { hasPermission, getRoleLabel, getRoleIcon } from '@/lib/permissions';
import { useLocation, Link } from 'react-router-dom';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { currentUser, logout } = useApp();
  const location = useLocation();

  if (!currentUser) {
    return null;
  }

  const menuItems = [
    {
      title: 'Agentes IA',
      icon: Bot,
      href: '/dashboard',
      permission: 'Usar agentes (interagir via chat)'
    },
    {
      title: 'Usuários',
      icon: Users,
      href: '/users',
      permission: 'Gerenciar usuários (convidar, editar, desativar)'
    },
    {
      title: 'Permissões',
      icon: Shield,
      href: '/permissions',
      permission: 'Ver a tela de Papéis e Permissões'
    },
    {
      title: 'Configurações',
      icon: Settings,
      href: '/settings',
      permission: 'Gerenciar módulos e configurações da organização'
    }
  ];

  const visibleMenuItems = menuItems.filter(item => 
    hasPermission(currentUser.role, item.permission)
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-gradient-surface">
        <Sidebar className="border-r">
          <SidebarHeader className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-primary rounded-lg shadow-primary">
                <Bot className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-bold text-lg">AI Portal</h2>
                <p className="text-sm text-muted-foreground">Gestão de IA</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="px-4">
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.href}>
                    <Link to={item.href} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors">
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {currentUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{currentUser.name}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <span>{getRoleIcon(currentUser.role)}</span>
                  {getRoleLabel(currentUser.role)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full justify-start gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="flex-1" />
            </div>
          </header>
          
          <div className="flex-1 p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;