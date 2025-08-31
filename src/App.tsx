import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "@/contexts/AppContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/UsersPage";
import PermissionsPage from "./pages/PermissionsPage";
import SettingsPage from "./pages/SettingsPage";
import AgentConfigPage from "./pages/AgentConfigPage";
import AgentChatPage from "./pages/AgentChatPage";
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
        <Route path="/organization" element={<OrganizationPage />} />
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/agents/new" element={<AgentConfigPage />} />
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
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
