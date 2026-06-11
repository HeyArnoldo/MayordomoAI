import { Navigate, Outlet } from 'react-router-dom';
import { UserRole, UserStatus } from '@app/contracts';
import { useMe } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-3 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

/** Envuelve las rutas privadas: sin sesión válida redirige a /login. */
export function ProtectedRoute() {
  const { data: user, isLoading } = useMe();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/**
 * Compuerta de la app completa: cuentas no aprobadas van a la lista de
 * espera, y las aprobadas sin onboarding pasan primero por ahí.
 */
export function OnboardedRoute() {
  const { data: user } = useMe();

  if (!user) return <Navigate to="/login" replace />;
  if (user.status !== UserStatus.ACTIVE) return <Navigate to="/espera" replace />;
  if (!user.onboardedAt) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** Solo admins; el backend lo re-valida con datos frescos en cada request. */
export function AdminRoute() {
  const { data: user } = useMe();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== UserRole.ADMIN) return <Navigate to="/" replace />;
  return <Outlet />;
}
