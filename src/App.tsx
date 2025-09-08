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
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/groups" element={<UserGroupsPage />} />
        <Route path="/organization" element={<OrganizationPage />} />
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/agents/new" element={<AgentConfigPage />} />
        <Route path="/agents/templates" element={<AgentTemplatesPage />} />
        <Route path="/agents/sharing" element={<AgentSharingPage />} />
        <Route path="/chat-history" element={<ChatHistoryPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/executive" element={<ExecutiveDashboardPage />} />
        <Route path="/system-admin" element={<SystemAdminPage />} />
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
