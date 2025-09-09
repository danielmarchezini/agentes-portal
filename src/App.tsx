import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppProvider, useApp } from "@/contexts/AppContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/UsersPage";
import UserGroupsPage from "./pages/UserGroupsPage";
import PermissionsPage from "./pages/PermissionsPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import AgentConfigPage from "./pages/AgentConfigPage";
import AgentChatPage from "./pages/AgentChatPage";
import AgentTemplatesPage from "./pages/AgentTemplatesPage";
import AgentSharingPage from "./pages/AgentSharingPage";
import ChatHistoryPage from "./pages/ChatHistoryPage";
import AuditPage from "./pages/AuditPage";
import ExecutiveDashboardPage from "./pages/ExecutiveDashboardPage";
import SystemAdminPage from "./pages/SystemAdminPage";
import OrganizationPage from "./pages/OrganizationPage";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "@/hooks/use-permissions";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return <Index />;
  }

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={
          <ProtectedRoute requiredPermission="Gerenciar usuários (convidar, editar, desativar)">
            <UsersPage />
          </ProtectedRoute>
        } />
        <Route path="/users/groups" element={
          <ProtectedRoute requiredPermission="Gerenciar grupos de usuários">
            <UserGroupsPage />
          </ProtectedRoute>
        } />
        <Route path="/user-groups" element={
          <ProtectedRoute requiredPermission="Gerenciar grupos de usuários">
            <UserGroupsPage />
          </ProtectedRoute>
        } />
        <Route path="/organization" element={
          <ProtectedRoute requiredPermission="Gerenciar módulos e configurações da organização">
            <OrganizationPage />
          </ProtectedRoute>
        } />
        <Route path="/permissions" element={
          <ProtectedRoute requiredPermission="Ver a tela de Papéis e Permissões">
            <PermissionsPage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/agents/new" element={
          <ProtectedRoute requiredPermission="Criar um novo agente">
            <AgentConfigPage />
          </ProtectedRoute>
        } />
        <Route path="/agents/templates" element={<AgentTemplatesPage />} />
        <Route path="/agents/sharing" element={
          <ProtectedRoute requiredPermission="Compartilhar agentes">
            <AgentSharingPage />
          </ProtectedRoute>
        } />
        <Route path="/chat/history" element={
          <ProtectedRoute requiredPermission="Ver histórico de conversas">
            <ChatHistoryPage />
          </ProtectedRoute>
        } />
        <Route path="/chat-history" element={
          <ProtectedRoute requiredPermission="Ver histórico de conversas">
            <ChatHistoryPage />
          </ProtectedRoute>
        } />
        <Route path="/audit" element={
          <ProtectedRoute requiredPermission="Ver logs de auditoria">
            <AuditPage />
          </ProtectedRoute>
        } />
        <Route path="/executive-dashboard" element={
          <ProtectedRoute requiredPermission="Ver dashboard executivo">
            <ExecutiveDashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/executive" element={
          <ProtectedRoute requiredPermission="Ver dashboard executivo">
            <ExecutiveDashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/system-admin" element={
          <ProtectedRoute requireSystemAdmin={true}>
            <SystemAdminPage />
          </ProtectedRoute>
        } />
        <Route path="/agents/edit/:id" element={<AgentConfigPage />} />
        <Route path="/agents/:id/config" element={<AgentConfigPage />} />
        <Route path="/agents/chat" element={<AgentChatPage />} />
        <Route path="/agents/chat/:id" element={<AgentChatPage />} />
        <Route path="/agents/:id/chat" element={<AgentChatPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DashboardLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <AppProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AppProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
