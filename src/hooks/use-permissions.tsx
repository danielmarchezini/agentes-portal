import { useApp } from '@/contexts/AppContext';
import { hasPermission } from '@/lib/permissions';
import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

export const usePermissions = () => {
  const { currentUser } = useApp();

  const checkPermission = (action: string): boolean => {
    if (!currentUser) return false;
    
    // System admin tem acesso total
    if (currentUser.email === 'dmarchezini@gmail.com') return true;
    
    return hasPermission(currentUser.role, action);
  };

  const isSystemAdmin = (): boolean => {
    return currentUser?.email === 'dmarchezini@gmail.com';
  };

  return {
    checkPermission,
    isSystemAdmin,
    currentUser
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
  const { checkPermission, isSystemAdmin } = usePermissions();

  if (requireSystemAdmin && !isSystemAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredPermission && !checkPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};