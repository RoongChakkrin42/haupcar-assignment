import type { UserRole } from '@haupcar/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ListSkeleton } from '@/components/states';
import { homeFor, useAuth } from './auth-context';

/** UX only — the API enforces the same rules. */
export function RequireAuth({
  requiredRole,
  children,
}: {
  requiredRole?: UserRole;
  children: ReactNode;
}) {
  const { user, loading, signedOut } = useAuth();
  const location = useLocation();

  if (loading) return <ListSkeleton />;
  if (!user) {
    // Only an expired session should bring the user back here after logging in again.
    if (signedOut) return <Navigate to="/login" replace />;
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (requiredRole && user.role !== requiredRole) return <Navigate to={homeFor(user)} replace />;
  return children;
}
