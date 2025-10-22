import { useApp } from '@/contexts/AppContext';
import { hasPermission } from '@/lib/permissions';
import { Navigate } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const usePermissions = () => {
  const { currentUser } = useApp();
  const [isOwnerGlobal, setIsOwnerGlobal] = useState<boolean>(false);
  const [checkingOwner, setCheckingOwner] = useState<boolean>(true);

  useEffect(() => {
    const checkOwner = async () => {
      setCheckingOwner(true);
      try {
        let isOwner = false;
        if (currentUser?.email) {
          // Regra 1: papel owner
          if (currentUser.role === 'owner') {
            isOwner = true;
          }
          // Regra 2: e-mail hardcoded (fallback)
          if (!isOwner && currentUser.email === 'dmarchezini@gmail.com') {
            isOwner = true;
          }
          // Regra 3: presença em system_owners
          if (!isOwner) {
            const { data } = await supabase
              .from('system_owners')
              .select('email')
              .eq('email', currentUser.email.toLowerCase())
              .maybeSingle();
            isOwner = !!data;
          }
        }
        setIsOwnerGlobal(isOwner);
      } catch {
        setIsOwnerGlobal(false);
      } finally {
        setCheckingOwner(false);
      }
    };
    checkOwner();
  }, [currentUser?.email, currentUser?.role]);

  const checkPermission = (action: string): boolean => {
    if (!currentUser) return false;
    // System admin tem acesso total
    if (isOwnerGlobal) return true;
    return hasPermission(currentUser.role, action);
  };

  const isSystemAdmin = (): boolean => {
    return !!isOwnerGlobal;
  };

  return {
    checkPermission,
    isSystemAdmin,
    currentUser,
    checkingOwner
  };
};

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  requireSystemAdmin?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requiredPermission, 
  requireSystemAdmin = false 
}: ProtectedRouteProps) => {
  const { checkPermission, isSystemAdmin, checkingOwner } = usePermissions();

  // Aguarda verificação antes de decidir
  if (checkingOwner) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p>Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (requireSystemAdmin && !isSystemAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredPermission && !checkPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};