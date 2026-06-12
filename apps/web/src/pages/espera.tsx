import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { Clock3, LogOut, ShieldAlert } from 'lucide-react';
import { UserStatus } from '@app/contracts';
import { useLogout, useMe } from '@/hooks/use-auth';
import { AuthShell, MobileBrandHeader } from '@/components/mayordomo/auth-shell';
import { Spinner } from '@/components/ui/spinner';

/**
 * Cola de espera: la cuenta existe pero sigue 'pending'. El polling detecta
 * la aprobación del admin y los guards de ruta llevan al onboarding solos.
 */
export default function EsperaPage() {
  const { t } = useTranslation('auth');
  // Polling: esperar la aprobación ES la función de esta pantalla.
  const { data: user } = useMe({ refetchInterval: 30_000 });
  const logout = useLogout();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/login" replace />;
  if (user.status === UserStatus.ACTIVE) {
    return <Navigate to={user.onboardedAt ? '/' : '/onboarding'} replace />;
  }

  const suspended = user.status === UserStatus.SUSPENDED;

  return (
    <AuthShell>
      <div className="flex flex-col">
        <MobileBrandHeader />

        <div className="mt-10 flex flex-col items-center text-center lg:mt-0 lg:items-start lg:text-left">
          <div
            className={`flex size-12 items-center justify-center rounded-[14px] ${
              suspended ? 'bg-negative-soft text-negative' : 'bg-brand-soft text-brand'
            }`}
          >
            {suspended ? <ShieldAlert className="size-6" /> : <Clock3 className="size-6" />}
          </div>

          <h2 className="mt-5 text-[26px] font-bold tracking-tight text-ink">
            {suspended ? t('waitlist.suspendedTitle') : t('waitlist.title')}
          </h2>
          <p className="mt-2 max-w-[340px] text-[14.5px] leading-relaxed text-ink-2">
            {suspended
              ? t('waitlist.suspendedBody')
              : t('waitlist.body', { name: user.name.split(' ')[0] })}
          </p>

          {!suspended && (
            <div className="mt-6 flex items-center gap-2.5 rounded-full border border-line bg-surface py-2 pr-4 pl-3">
              <Spinner className="size-4 text-brand" />
              <span className="text-[12.5px] font-medium text-ink-2">{t('waitlist.checking')}</span>
            </div>
          )}

          <button
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
            className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-3 hover:text-ink"
          >
            <LogOut className="size-3.5" />
            {t('waitlist.logout')}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
