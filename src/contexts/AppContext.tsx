import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { applyBranding, updateFavicon, loadBrandingFromStorage, saveBrandingToStorage, DEFAULT_BRANDING } from "@/lib/branding";

export type UserRole = 'owner' | 'admin' | 'bot_manager' | 'member';

export interface LLMProvider {
  id: string;
  name: string;
  models: {
    id: string;
    name: string;
    description?: string;
  }[];
  apiKeyRequired: boolean;
  enabled: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'pending' | 'inactive';
  created_at: string;
  last_login?: string;
  organization_id?: string;
}

export interface Agent {
  id: string;
  name: string;
  slug?: string;
  description: string;
  category: string;
  model: string;
  systemPrompt: string;
  status: 'active' | 'inactive' | 'pending';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  usageCount: number;
  tags: string[];
  // Novo: modo do agente e suporte a assistentes externos
  mode?: 'custom' | 'assistant';
  assistant_provider?: 'openai' | 'anthropic' | 'google' | string;
  assistant_id?: string;
  // Vector store (OpenAI) associado para reuso de arquivos
  vector_store_id?: string | null;
  // Opções por agente para anexos
  allow_file_uploads?: boolean;
  file_storage_mode?: 'openai_vector_store' | 'local_rag';
  rag_collection_id?: string | null;
  // Limite de retenção de histórico (nº máximo de mensagens armazenadas)
  retention_limit?: number;
  // Retenção por tempo (dias). 0 ou undefined = desabilitado
  retention_days?: number;
  // Flag derivada: indica se há compartilhamento público ativo (para UI)
  isPublic?: boolean;
  // Providers de LLM
  generation_provider?: 'openai' | 'anthropic' | 'google' | 'perplexity' | 'ollama';
  embedding_provider?: 'openai' | 'ollama';
  embedding_model?: string;
  // Configuração Ollama
  ollama_url?: string;
}

export interface Organization {
  id: string;
  name: string;
  domain: string;
  cnpj: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  contacts: {
    phone: string;
    email: string;
    responsibleName: string;
    responsibleRole: string;
  };
  contract: {
    plan: string;
    startDate: string;
    expirationDate: string;
    monthlyValue: number;
    status: 'active' | 'suspended' | 'expired';
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  notifications: {
    emailTemplates: {
      welcome: string;
      invitation: string;
      passwordReset: string;
    };
    logoUrl?: string;
    brandColor: string;
    // Extended org notifications/config fields
    responsibleName?: string;
    responsibleRole?: string;
    webhookUrl?: string;
    slackWebhook?: string;
    enableEmail?: boolean;
  };
  llmProviders?: LLMProvider[];
  branding?: {
    logo?: string;
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
  };
}

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  organization: Organization | null;
  setOrganization: (org: Organization | null) => void;
  // Modo suporte: owner global escolhe outra organização sem alterar seu perfil real
  supportMode: boolean;
  enterSupportOrg: (orgId: string) => Promise<void>;
  exitSupportMode: () => void;
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  refreshAgents: () => Promise<void>;
  users: User[];
  setUsers: (users: User[]) => void;
  isAuthenticated: boolean;
  session: Session | null;
  requestLogin: (email: string) => Promise<{ error: any }>;
  login: (email: string, token: string) => Promise<boolean>;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null); // Start with null
  const [realOrganization, setRealOrganization] = useState<Organization | null>(null); // Org do perfil do usuário
  const [agents, setAgents] = useState<Agent[]>([]); // Start with empty
  const [users, setUsers] = useState<User[]>([]); // Start with empty
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supportMode, setSupportMode] = useState(false);

  // Session and user profile management
  useEffect(() => {
    const isUuid = (v?: string) => !!(v && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v));
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setIsAuthenticated(!!session);
      if (session) {
        // Tenta buscar o profile pelo id; se falhar, tenta por email (fallback)
        let userProfile: any = null;
        try {
          const res = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          userProfile = res.data;
        } catch {}
        if (!userProfile && session.user.email) {
          try {
            const res2 = await supabase
              .from('profiles')
              .select('*')
              .eq('email', session.user.email)
              .maybeSingle();
            userProfile = res2.data;
          } catch {}
        }

        if (userProfile) {
          setCurrentUser(userProfile as User);
          // Fetch organization, users, and agents based on user's organization
          const orgId = userProfile.organization_id;
          if (isUuid(orgId)) {
            const { data: orgData } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', orgId)
              .is('deleted_at', null)
              .maybeSingle();
            if (orgData) {
              setRealOrganization(orgData as Organization);
              // Se não estiver em modo suporte, a org ativa acompanha a real
              if (!supportMode) setOrganization(orgData as Organization);

              const { data: usersData } = await supabase.from('profiles').select('*').eq('organization_id', orgId);
              setUsers(usersData as User[]);

              const { data: agentsData } = await supabase.from('agents').select('*').eq('organization_id', orgId);
              setAgents(agentsData as Agent[]);
            } else {
              // Org arquivada ou inexistente: limpa org do contexto (não altera o profile no banco)
              setRealOrganization(null);
              if (!supportMode) setOrganization(null);
            }
          } else {
            // organization_id inválido; evita 400 e segue sem org
            setRealOrganization(null);
            if (!supportMode) setOrganization(null);
          }
        }
      }
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAuthenticated(!!session);
      if (!session) {
        setCurrentUser(null);
      } else {
        // Fetch profile on sign in
        const fetchProfile = async () => {
          // Tenta buscar o profile pelo id; se falhar, tenta por email (fallback)
          let userProfile: any = null;
          try {
            const res = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            userProfile = res.data;
          } catch {}
          if (!userProfile && session.user.email) {
            try {
              const res2 = await supabase
                .from('profiles')
                .select('*')
                .eq('email', session.user.email)
                .maybeSingle();
              userProfile = res2.data;
            } catch {}
          }

          if (userProfile) {
            setCurrentUser(userProfile as User);
            // Fetch organization, users, and agents based on user's organization
            const orgId = userProfile.organization_id;
            if (isUuid(orgId)) {
              const { data: orgData } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', orgId)
                .is('deleted_at', null)
                .maybeSingle();
              if (orgData) {
                setRealOrganization(orgData as Organization);
                if (!supportMode) setOrganization(orgData as Organization);

                const { data: usersData } = await supabase.from('profiles').select('*').eq('organization_id', orgId);
                setUsers(usersData as User[]);

                const { data: agentsData } = await supabase.from('agents').select('*').eq('organization_id', orgId);
                setAgents(agentsData as Agent[]);
              } else {
                setRealOrganization(null);
                if (!supportMode) setOrganization(null);
              }
            } else {
              setRealOrganization(null);
              if (!supportMode) setOrganization(null);
            }
          }
        }
        fetchProfile();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Apply branding whenever organization changes
  useEffect(() => {
    if (organization?.branding?.colors) {
      const branding = {
        logo: organization.branding.logo,
        primaryColor: organization.branding.colors.primary || DEFAULT_BRANDING.primaryColor,
        secondaryColor: organization.branding.colors.secondary || DEFAULT_BRANDING.secondaryColor,
        accentColor: organization.branding.colors.accent || DEFAULT_BRANDING.accentColor,
      };
      saveBrandingToStorage(branding);
      applyBranding(branding);
      updateFavicon(branding.logo, organization.name);
    }
  }, [organization?.branding, organization?.name]);

  const setOrganizationWithBranding = (org: Organization | null) => {
    setOrganization(org);
  };

  // Entra em modo suporte escolhendo uma organização por ID (não altera o profile do usuário)
  const enterSupportOrg = async (orgId: string) => {
    if (!orgId) return;
    const { data: orgData, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) return;
    if (!orgData) return; // não entrar em modo suporte para org arquivada
    setSupportMode(true);
    setOrganization(orgData as Organization);
  };

  // Sai do modo suporte e restaura org real
  const exitSupportMode = () => {
    setSupportMode(false);
    setOrganization(realOrganization || null);
  };

  const refreshAgents = async () => {
    try {
      if (!organization?.id) return;
      const { data } = await supabase
        .from('agents')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      if (data) setAgents(data as Agent[]);
    } catch {}
  };

  const requestLogin = async (email: string) => {
    // Importante: não passar emailRedirectTo para forçar o envio de OTP numérico ({{ .Token }})
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    return { error };
  };

  const login = async (email: string, token: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error || !data.session) {
      console.error('Login failed:', error?.message);
      return false;
    }
    // onAuthStateChange will handle setting the user and session
    return true;
  };

  const logout = async () => {
    try {
      // Revoga sessão no dispositivo e no servidor
      await supabase.auth.signOut({ scope: 'global' as any });
    } catch (e) {
      console.warn('signOut error (ignorado):', (e as any)?.message);
    } finally {
      // Limpa estados do app
      setCurrentUser(null);
      setOrganization(null);
      setAgents([]);
      setUsers([]);
      setIsAuthenticated(false);

      // Limpa possíveis sessões persistidas do Supabase (sb-*)
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('sb-')) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
      } catch {}

      // Força reload para garantir que qualquer cache em memória seja descartado
      if (typeof window !== 'undefined') {
        window.location.replace('/');
      }
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      organization,
      setOrganization: setOrganizationWithBranding,
      supportMode,
      enterSupportOrg,
      exitSupportMode,
      agents,
      setAgents,
      refreshAgents,
      users,
      setUsers,
      isAuthenticated,
      session,
      requestLogin,
      login,
      logout
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};