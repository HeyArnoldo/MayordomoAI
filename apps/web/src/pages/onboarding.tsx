import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, Phone } from 'lucide-react';
import { UserStatus } from '@app/contracts';
import { useMe } from '@/hooks/use-auth';
import { usersApi } from '@/services/users.api';
import { translateApiError } from '@/lib/api-error';
import { AuthShell, MobileBrandHeader } from '@/components/mayordomo/auth-shell';
import { CodeInput, useCodeInput } from '@/features/phone/code-input';
import { PhoneNumberInput } from '@/features/phone/phone-number-input';

const E164 = /^\+[1-9]\d{7,14}$/;
const RESEND_SECONDS = 60;

/**
 * Onboarding post-aprobación: Paso 1 ingresa el número, Paso 2 verifica el
 * código de 6 dígitos que llega por WhatsApp. "Saltar" cierra el onboarding
 * sin verificar (se puede vincular después).
 */
export default function OnboardingPage() {
  const { t } = useTranslation('auth');
  const { data: user } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [e164, setE164] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const finish = async () => {
    await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    // After the phone step (onboardedAt set), route to /chat where the AI
    // onboarding flow continues if onboardingCompleted is still false.
    navigate('/chat', { replace: true });
  };

  const link = useMutation({
    mutationFn: usersApi.linkPhone,
    onSuccess: (phone) => {
      if (phone.verified) {
        toast.success(t('onboarding.toasts.alreadyVerified'));
        void usersApi.completeOnboarding().then(finish);
        return;
      }
      setStep('code');
      setCooldown(RESEND_SECONDS);
    },
    onError: (err) => toast.error(translateApiError(err)),
  });

  const verify = useMutation({
    mutationFn: usersApi.verifyPhone,
    onSuccess: () => {
      toast.success(t('onboarding.toasts.verified'));
      void finish();
    },
    onError: (err) => toast.error(translateApiError(err)),
  });

  const resend = useMutation({
    mutationFn: usersApi.resendCode,
    onSuccess: () => {
      toast.success(t('onboarding.toasts.resent'));
      setCooldown(RESEND_SECONDS);
    },
    onError: (err) => toast.error(translateApiError(err)),
  });

  const skip = useMutation({
    mutationFn: usersApi.completeOnboarding,
    onSuccess: () => void finish(),
    onError: (err) => toast.error(translateApiError(err)),
  });

  if (!user) return <Navigate to="/login" replace />;
  if (user.status !== UserStatus.ACTIVE) return <Navigate to="/espera" replace />;
  if (user.onboardedAt) return <Navigate to="/" replace />;

  return (
    <AuthShell>
      {step === 'phone' ? (
        <PhoneStep
          e164={e164}
          onChange={setE164}
          pending={link.isPending}
          onSubmit={() => link.mutate({ e164 })}
          onSkip={() => skip.mutate()}
          skipping={skip.isPending}
        />
      ) : (
        <CodeStep
          e164={e164}
          cooldown={cooldown}
          pending={verify.isPending}
          onBack={() => setStep('phone')}
          onVerify={(code) => verify.mutate({ code })}
          onResend={() => resend.mutate()}
          resending={resend.isPending}
          onSkip={() => skip.mutate()}
        />
      )}
    </AuthShell>
  );
}

function StepHeader({ step, onBack }: { step: 1 | 2; onBack?: () => void }) {
  const { t } = useTranslation('auth');
  return (
    <>
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink-2 hover:bg-surface-alt"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
          {t('onboarding.stepOf', { step, total: 2 })}
        </span>
      </div>
      <div className="mt-3.5 flex gap-1.5">
        <div className="h-1 flex-1 rounded-full bg-brand" />
        <div className={`h-1 flex-1 rounded-full ${step === 2 ? 'bg-brand' : 'bg-surface-alt'}`} />
      </div>
    </>
  );
}

function PhoneStep(props: {
  e164: string;
  onChange: (v: string) => void;
  pending: boolean;
  onSubmit: () => void;
  onSkip: () => void;
  skipping: boolean;
}) {
  const { t } = useTranslation('auth');
  const valid = E164.test(props.e164);
  return (
    <div className="flex flex-col">
      <div className="mb-8 lg:hidden">
        <MobileBrandHeader />
      </div>
      <StepHeader step={1} />
      <h2 className="mt-7 text-[26px] font-bold tracking-tight text-ink">
        {t('onboarding.phone.title')}
      </h2>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-2">
        {t('onboarding.phone.subtitle')}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) props.onSubmit();
        }}
        className="mt-7"
      >
        <PhoneNumberInput onChange={props.onChange} autoFocus />
        <p className="mt-2 text-[12px] text-ink-3">{t('onboarding.phone.hint')}</p>

        <button
          type="submit"
          disabled={!valid || props.pending}
          className="mt-7 inline-flex h-[50px] w-full items-center justify-center rounded-[14px] bg-brand text-[16px] font-semibold text-on-brand transition disabled:pointer-events-none disabled:opacity-50"
        >
          {props.pending ? t('onboarding.phone.submitting') : t('onboarding.phone.submit')}
        </button>
      </form>

      <button
        onClick={props.onSkip}
        disabled={props.skipping}
        className="mt-4 text-center text-[12.5px] text-ink-3 hover:text-ink"
      >
        {t('onboarding.phone.skipPrefix')}{' '}
        <span className="font-semibold text-brand">{t('onboarding.phone.skipAction')}</span>
      </button>
    </div>
  );
}

function CodeStep(props: {
  e164: string;
  cooldown: number;
  pending: boolean;
  resending: boolean;
  onBack: () => void;
  onVerify: (code: string) => void;
  onResend: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation('auth');
  const { code, setCode, full, value } = useCodeInput();

  return (
    <div className="flex flex-col">
      <StepHeader step={2} onBack={props.onBack} />
      <h2 className="mt-7 text-[26px] font-bold tracking-tight text-ink">
        {t('onboarding.code.title')}
      </h2>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-2">
        {t('onboarding.code.subtitle')}
      </p>

      {/* card del número, con "Cambiar" como en el design */}
      <div className="mt-6 flex items-center gap-3 rounded-[14px] border border-line bg-surface p-3.5">
        <div className="flex size-10 items-center justify-center rounded-[13px] bg-brand-soft text-brand">
          <Phone className="size-[19px]" />
        </div>
        <div className="flex-1">
          <div className="font-mono text-[15px] font-semibold text-ink">{props.e164}</div>
          <div className="mt-px text-[12px] text-ink-3">{t('onboarding.code.phoneCardHint')}</div>
        </div>
        <button onClick={props.onBack} className="text-[12.5px] font-semibold text-brand">
          {t('onboarding.code.change')}
        </button>
      </div>

      <div className="mt-8">
        <CodeInput code={code} onChange={setCode} />
      </div>

      <div className="mt-[18px] text-center text-[13px] text-ink-2">
        {t('onboarding.code.notReceived')}{' '}
        {props.cooldown > 0 ? (
          <>
            <span className="font-semibold text-ink-3">{t('onboarding.code.resend')}</span>{' '}
            <span className="text-ink-3">(0:{String(props.cooldown).padStart(2, '0')})</span>
          </>
        ) : (
          <button
            onClick={props.onResend}
            disabled={props.resending}
            className="font-semibold text-brand"
          >
            {props.resending ? t('onboarding.code.resending') : t('onboarding.code.resend')}
          </button>
        )}
      </div>

      <button
        onClick={() => props.onVerify(value)}
        disabled={!full || props.pending}
        className="mt-8 inline-flex h-[50px] w-full items-center justify-center rounded-[14px] bg-brand text-[16px] font-semibold text-on-brand transition disabled:pointer-events-none disabled:opacity-50"
      >
        {props.pending ? t('onboarding.code.verifying') : t('onboarding.code.verify')}
      </button>

      <div className="mt-3.5 text-center text-[12px] text-ink-3">
        {t('onboarding.code.oneAccount')}{' '}
        <button onClick={props.onSkip} className="font-semibold text-brand">
          {t('onboarding.code.skip')}
        </button>
      </div>
    </div>
  );
}
