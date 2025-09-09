import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
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
  createdAt: string;
  lastLogin?: string;
}

export interface Agent {
  id: string;
  name: string;
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
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  users: User[];
  setUsers: (users: User[]) => void;
  isAuthenticated: boolean;
  login: (email: string, code: string) => Promise<boolean>;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Mock data
const mockOrganization: Organization = {
  id: '1',
  name: 'Acme Corporation',
  domain: 'acme.com',
  cnpj: '12.345.678/0001-90',
  address: {
    street: 'Rua das Empresas',
    number: '123',
    complement: 'Sala 456',
    neighborhood: 'Centro Empresarial',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01234-567'
  },
  contacts: {
    phone: '(11) 9999-8888',
    email: 'contato@acme.com',
    responsibleName: 'João Silva',
    responsibleRole: 'CEO'
  },
  contract: {
    plan: 'Enterprise',
    startDate: '2024-01-01',
    expirationDate: '2024-12-31',
    monthlyValue: 2500.00,
    status: 'active'
  },
  notifications: {
    emailTemplates: {
      welcome: 'Bem-vindo à {{organizationName}}! Sua conta foi criada com sucesso.',
      invitation: 'Você foi convidado para participar da {{organizationName}}. Clique no link para aceitar.',
      passwordReset: 'Solicitação de redefinição de senha para {{organizationName}}.'
    },
    brandColor: '#0ea5e9'
  },
  llmProviders: [
    {
      id: "openai",
      name: "OpenAI",
      models: [
        { id: "gpt-4", name: "GPT-4", description: "Modelo mais avançado da OpenAI" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Versão otimizada do GPT-4" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Modelo rápido e eficiente" }
      ],
      apiKeyRequired: true,
      enabled: true
    },
    {
      id: "anthropic",
      name: "Anthropic",
      models: [
        { id: "claude-3-opus", name: "Claude 3 Opus", description: "O modelo mais poderoso da Anthropic" },
        { id: "claude-3-sonnet", name: "Claude 3 Sonnet", description: "Equilibra performance e custo" },
        { id: "claude-3-haiku", name: "Claude 3 Haiku", description: "Modelo rápido e econômico" }
      ],
      apiKeyRequired: true,
      enabled: true
    },
    {
      id: "google",
      name: "Google",
      models: [
        { id: "gemini-pro", name: "Gemini Pro", description: "Modelo avançado do Google" },
        { id: "gemini-pro-vision", name: "Gemini Pro Vision", description: "Modelo com capacidades visuais" }
      ],
      apiKeyRequired: true,
      enabled: true
    },
    {
      id: "cohere",
      name: "Cohere",
      models: [
        { id: "command", name: "Command", description: "Modelo de linguagem da Cohere" },
        { id: "command-light", name: "Command Light", description: "Versão otimizada do Command" }
      ],
      apiKeyRequired: true,
      enabled: false
    }
  ],
  branding: {
    logo: '',
    colors: {
      primary: '222.2 84% 4.9%',
      secondary: '210 40% 98%',
      accent: '210 40% 96%'
    }
  }
};

const mockUsers: User[] = [
  {
    id: '1',
    email: 'dmarchezini@gmail.com',
    name: 'Daniel Marchezini',
    role: 'owner',
    status: 'active',
    createdAt: '2024-01-15',
    lastLogin: '2024-01-20'
  },
  {
    id: '2',
    email: 'admin@acme.com',
    name: 'Administrador',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-15',
    lastLogin: '2024-01-20'
  },
  {
    id: '3',
    email: 'manager@acme.com',
    name: 'Bot Manager Santos',
    role: 'bot_manager',
    status: 'active',
    createdAt: '2024-01-16',
    lastLogin: '2024-01-19'
  },
  {
    id: '4',
    email: 'user@acme.com',
    name: 'User Oliveira',
    role: 'member',
    status: 'active',
    createdAt: '2024-01-17',
    lastLogin: '2024-01-18'
  }
];

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Assistente de Análise',
    description: 'Especializado em análise de dados e relatórios',
    category: 'Análise',
    model: 'gpt-4',
    systemPrompt: 'Você é um especialista em análise de dados...',
    status: 'active',
    createdBy: '2',
    createdAt: '2024-01-10',
    updatedAt: '2024-01-15',
    version: 2,
    usageCount: 156,
    tags: ['análise', 'dados', 'relatórios']
  },
  {
    id: '2',
    name: 'Criativo Marketing',
    description: 'Criação de conteúdo e campanhas de marketing',
    category: 'Criatividade',
    model: 'gpt-4',
    systemPrompt: 'Você é um especialista em marketing criativo...',
    status: 'active',
    createdBy: '2',
    createdAt: '2024-01-12',
    updatedAt: '2024-01-18',
    version: 1,
    usageCount: 89,
    tags: ['marketing', 'criatividade', 'conteúdo']
  },
  {
    id: '3',
    name: 'Suporte Técnico',
    description: 'Resolução de problemas técnicos e troubleshooting',
    category: 'Suporte',
    model: 'gpt-3.5-turbo',
    systemPrompt: 'Você é um especialista em suporte técnico...',
    status: 'inactive',
    createdBy: '2',
    createdAt: '2024-01-14',
    updatedAt: '2024-01-14',
    version: 1,
    usageCount: 23,
    tags: ['suporte', 'técnico', 'troubleshooting']
  }
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(mockOrganization);
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize branding on app load
  useEffect(() => {
    const savedBranding = loadBrandingFromStorage();
    if (savedBranding) {
      applyBranding(savedBranding);
      updateFavicon(savedBranding.logo, organization?.name || 'AI Portal');
    } else {
      applyBranding(DEFAULT_BRANDING);
      updateFavicon(undefined, organization?.name || 'AI Portal');
    }
  }, [organization?.name]);

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
    // Branding application is handled by the useEffect above
  };

  const login = async (email: string, code: string): Promise<boolean> => {
    // Mock login logic - accept any email with the code 123456
    if (code !== '123456' || !email) return false;

    // Try to find existing user in state
    let user = users.find(u => u.email === email) || null;

    if (!user) {
      const nameFromEmail = email.split('@')[0]?.replace(/[._-]/g, ' ') || 'Novo Usuário';
      const today = new Date().toISOString().slice(0, 10);
      
      // Verificar se é o admin do sistema
      let role: UserRole = 'member';
      if (email === 'dmarchezini@gmail.com') {
        role = 'owner';
      }
      
      user = {
        id: String(Date.now()),
        email,
        name: nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1),
        role,
        status: 'active',
        createdAt: today,
        lastLogin: today,
      };
      setUsers([...users, user]);
    } else {
      // Update last login for existing user
      user = { ...user, lastLogin: new Date().toISOString().slice(0, 10) };
      setUsers(users.map(u => (u.id === user!.id ? user! : u)));
    }

    setCurrentUser(user);
    setIsAuthenticated(true);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      organization,
      setOrganization: setOrganizationWithBranding,
      agents,
      setAgents,
      users,
      setUsers,
      isAuthenticated,
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