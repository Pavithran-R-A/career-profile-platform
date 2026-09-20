import { Navigate, useLocation } from 'react-router';
import { useAuth } from './context';

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireVerified?: boolean;
};

export function ProtectedRoute({
  children,
  requireAuth = true,
  requireVerified = false,
}: ProtectedRouteProps) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (requireAuth && auth.status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!requireAuth && auth.status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireVerified && auth.status === 'authenticated' && !auth.user.emailConfirmed) {
    return <Navigate to="/verify-email" replace />;
  }

  return <>{children}</>;
}
