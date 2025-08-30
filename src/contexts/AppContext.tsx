import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'owner' | 'admin' | 'bot_manager' | 'member';

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
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
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
  domain: 'acme.com'
};

const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@acme.com',
    name: 'Admin Silva',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-15',
    lastLogin: '2024-01-20'
  },
  {
    id: '2',
    email: 'manager@acme.com',
    name: 'Bot Manager Santos',
    role: 'bot_manager',
    status: 'active',
    createdAt: '2024-01-16',
    lastLogin: '2024-01-19'
  },
  {
    id: '3',
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

  const login = async (email: string, code: string): Promise<boolean> => {
    // Mock login logic - accept any email with the code 123456
    if (code !== '123456' || !email) return false;

    // Try to find existing user in state
    let user = users.find(u => u.email === email) || null;

    if (!user) {
      const nameFromEmail = email.split('@')[0]?.replace(/[._-]/g, ' ') || 'Novo Usuário';
      const today = new Date().toISOString().slice(0, 10);
      user = {
        id: String(Date.now()),
        email,
        name: nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1),
        role: 'member',
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
      setOrganization,
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