import { UserRole } from '@/contexts/AppContext';

export interface Permission {
  action: string;
  roles: Record<UserRole, boolean>;
}

export interface PermissionCategory {
  category: string;
  permissions: Permission[];
}

export const permissionMatrix: PermissionCategory[] = [
  {
    category: "Gestão da Organização",
    permissions: [
      {
        action: "Gerenciar usuários (convidar, editar, desativar)",
        roles: {
          member: false,
          bot_manager: false,
          admin: true,
          owner: true
        }
      },
      {
        action: "Gerenciar módulos e configurações da organização",
        roles: {
          member: false,
          bot_manager: false,
          admin: true,
          owner: true
        }
      },
      {
        action: "Configurar SMTP e templates de e-mail",
        roles: {
          member: false,
          bot_manager: false,
          admin: true,
          owner: true
        }
      },
      {
        action: "Ver a tela de Papéis e Permissões",
        roles: {
          member: true,
          bot_manager: true,
          admin: true,
          owner: true
        }
      },
      {
        action: "Gerenciar grupos de usuários",
        roles: {
          member: false,
          bot_manager: false,
          admin: true,
          owner: true
        }
      },
      {
        action: "Ver logs de auditoria",
        roles: {
          member: false,
          bot_manager: true,
          admin: true,
          owner: true
        }
      },
      {
        action: "Ver dashboard executivo",
        roles: {
          member: false,
          bot_manager: false,
          admin: true,
          owner: true
        }
      }
    ]
  },
  {
    category: "Módulo: AI Agents",
    permissions: [
      {
        action: "Usar agentes (interagir via chat)",
        roles: {
          member: true,
          bot_manager: true,
          admin: true,
          owner: true
        }
      },
      {
        action: "Sugerir alteração de prompt",
        roles: {
          member: true,
          bot_manager: true,
          admin: true,
          owner: true
        }
      },
      {
        action: "Criar um novo agente",
        roles: {
          member: false,
          bot_manager: true,
          admin: true,
          owner: true
        }
      },
      {
        action: "Editar a configuração de um agente",
        roles: {
          member: false,
          bot_manager: true,
          admin: true,
          owner: true
        }
      },
      {
        action: "Aprovar ou rejeitar uma sugestão de prompt",
        roles: {
          member: false,
          bot_manager: true,
          admin: true,
          owner: true
        }
      },
      {
        action: "Ver o histórico de versões de um agente",
        roles: {
          member: true,
          bot_manager: true,
          admin: true,
          owner: true
        }
      },
      {
        action: "Deletar um agente",
        roles: {
          member: false,
          bot_manager: true,
          admin: true,
          owner: true
        }
      },
      {
        action: "Ver histórico de conversas",
        roles: {
          member: true,
          bot_manager: true,
          admin: true,
          owner: true
        }
      },
      {
        action: "Compartilhar agentes",
        roles: {
          member: true,
          bot_manager: true,
          admin: true,
          owner: true
        }
      }
    ]
  }
];

export const hasPermission = (userRole: UserRole, action: string): boolean => {
  for (const category of permissionMatrix) {
    const permission = category.permissions.find(p => p.action === action);
    if (permission) {
      return permission.roles[userRole];
    }
  }
  return false;
};

export const getRoleLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    bot_manager: 'Gestor de Bots',
    member: 'Membro'
  };
  return labels[role];
};

export const getRoleIcon = (role: UserRole): string => {
  const icons: Record<UserRole, string> = {
    owner: '👑',
    admin: '🛡️',
    bot_manager: '🤖',
    member: '👤'
  };
  return icons[role];
};