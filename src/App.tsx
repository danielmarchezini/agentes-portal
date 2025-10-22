import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { toast as sonnerToast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/UsersPage";
import UserGroupsPage from "./pages/UserGroupsPage";
import GroupMembersPage from "./pages/GroupMembersPage";
import PermissionsPage from "./pages/PermissionsPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import AgentConfigPage from "./pages/AgentConfigPage";
import AgentChatPage from "./pages/AgentChatPage";
import AgentTemplatesPage from "./pages/AgentTemplatesPage";
import AgentSharingPage from "./pages/AgentSharingPage";
import Logout from "./pages/Logout";
import ChatHistoryPage from "./pages/ChatHistoryPage";
import AuditPage from "./pages/AuditPage";
import ExecutiveDashboardPage from "./pages/ExecutiveDashboardPage";
import SystemAdminPage from "./pages/SystemAdminPage";
import ModelCatalogAdminPage from "./pages/ModelCatalogAdminPage";
import OwnerAdminTemplatesPage from "./pages/OwnerAdminTemplates";
import OrganizationPage from "./pages/OrganizationPage";
import AgentRequestsPage from "./pages/AgentRequestsPage";
import NotFound from "./pages/NotFound";
import ManualPage from "./pages/ManualPage";
import ExternalActionsPage from "./pages/ExternalActionsPage";
import { ProtectedRoute } from "@/hooks/use-permissions";
import ErrorBoundary from "@/components/common/ErrorBoundary";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isAuthenticated, currentUser } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Index />;
  }

  // Força preenchimento de perfil somente quando o perfil já foi carregado e o nome está realmente vazio
  // Evita redirecionar durante o carregamento inicial (quando currentUser ainda é null)
  const profileLoaded = currentUser !== null; // simples heurística; currentUser null implica ainda carregando/buscando
  const nameValue = (currentUser?.name || "").trim();
  const needsProfile = profileLoaded && nameValue.length === 0;
  const isOnProfile = location.pathname === "/profile";
  if (needsProfile && !isOnProfile) {
    // aviso sutil para completar o perfil
    sonnerToast("Complete seu perfil", { description: "Informe seu nome para continuar usando o portal." });
  }
  if (needsProfile && !isOnProfile) {
    return <Navigate to="/profile" replace />;
  }
  // Permite acessar /profile mesmo com perfil completo

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/logout" element={<Logout />} />
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
        <Route path="/user-groups/:id/members" element={
          <ProtectedRoute requiredPermission="Gerenciar grupos de usuários">
            <GroupMembersPage />
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
        <Route path="/settings/integrations/external-actions" element={
          <ProtectedRoute requiredPermission="Gerenciar módulos e configurações da organização">
            <ExternalActionsPage />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/agents/new" element={
          <ProtectedRoute requiredPermission="Criar um novo agente">
            <AgentConfigPage />
          </ProtectedRoute>
        } />
        <Route path="/agents/templates" element={<Navigate to="/marketplace" replace />} />
        <Route path="/marketplace" element={<AgentTemplatesPage />} />
        <Route path="/agents/sharing" element={
          <ProtectedRoute requiredPermission="Compartilhar agentes">
            <AgentSharingPage />
          </ProtectedRoute>
        } />
        <Route path="/agents/requests" element={
          <ProtectedRoute requiredPermission="Ver solicitações de agentes">
            <AgentRequestsPage />
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
        <Route path="/admin/model-catalog" element={
          <ProtectedRoute requireSystemAdmin={true}>
            <ModelCatalogAdminPage />
          </ProtectedRoute>
        } />
        <Route path="/owner/templates" element={
          <ProtectedRoute requireSystemAdmin={true}>
            <OwnerAdminTemplatesPage />
          </ProtectedRoute>
        } />
        <Route path="/agents/edit/:id" element={<AgentConfigPage />} />
        <Route path="/agents/:id/config" element={<AgentConfigPage />} />
        <Route path="/agents/chat" element={<AgentChatPage />} />
        <Route path="/agents/chat/:id" element={<AgentChatPage />} />
        <Route path="/agents/:id/chat" element={<AgentChatPage />} />
        <Route path="/manual" element={
          <ProtectedRoute requiredPermission="Ver Manual">
            <ManualPage />
          </ProtectedRoute>
        } />
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
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </BrowserRouter>
        </AppProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
