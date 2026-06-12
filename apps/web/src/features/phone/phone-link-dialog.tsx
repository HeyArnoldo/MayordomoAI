import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { usersApi } from '@/services/users.api';
import { translateApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CodeInput, useCodeInput } from './code-input';
import { PhoneNumberInput } from './phone-number-input';

const E164 = /^\+[1-9]\d{7,14}$/;
const RESEND_SECONDS = 60;
const PHONES_KEY = ['me', 'phones'] as const;

/**
 * Vincular o cambiar el número de WhatsApp desde la app (menú de perfil).
 * Mismo backend que el onboarding: requestCode → código de 6 dígitos.
 */
export function PhoneLinkDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('phone');
  const qc = useQueryClient();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [e164, setE164] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useCodeInput();

  const { data: phones = [] } = useQuery({
    queryKey: PHONES_KEY,
    queryFn: usersApi.phones,
    enabled: open,
  });
  const current = phones[0];
  const changing = Boolean(current?.verified);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: PHONES_KEY });
    void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
  };

  const close = () => {
    onOpenChange(false);
    setStep('phone');
    setE164('');
    codeInput.reset();
  };

  const link = useMutation({
    mutationFn: usersApi.linkPhone,
    onSuccess: (phone) => {
      invalidate();
      if (phone.verified) {
        toast.success(t('link.alreadyVerified'));
        close();
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
      invalidate();
      toast.success(t('link.verifiedLinked'));
      close();
    },
    onError: (err) => toast.error(translateApiError(err)),
  });

  const resend = useMutation({
    mutationFn: usersApi.resendCode,
    onSuccess: () => {
      toast.success(t('link.resent'));
      setCooldown(RESEND_SECONDS);
    },
    onError: (err) => toast.error(translateApiError(err)),
  });

  const valid = E164.test(e164);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-[18px] text-brand" />
            {changing ? t('link.changeTitle') : t('link.linkTitle')}
          </DialogTitle>
          <DialogDescription>
            {step === 'phone'
              ? t('link.phoneStepDescription')
              : t('link.codeStepDescription', { phone: e164 })}
          </DialogDescription>
        </DialogHeader>

        {step === 'phone' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid && !link.isPending) link.mutate({ e164 });
            }}
            className="space-y-4"
          >
            {current && (
              <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-alt/60 px-3.5 py-2.5">
                <span className="font-mono text-[13.5px] font-semibold text-ink">
                  {current.e164}
                </span>
                {current.verified ? (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand">
                    <ShieldCheck className="size-3.5" /> {t('link.verified')}
                  </span>
                ) : (
                  <span className="text-[11.5px] font-semibold text-warn">
                    {t('link.unverified')}
                  </span>
                )}
              </div>
            )}

            <PhoneNumberInput initialE164={current?.e164} onChange={setE164} autoFocus />
            <p className="text-[12px] text-ink-3">{t('link.digitsHint')}</p>

            {changing && (
              <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-3.5 py-2.5">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                <p className="text-[12px] leading-snug text-ink-2">{t('link.changeWarning')}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={!valid || link.isPending}>
              {link.isPending ? t('link.sendingCode') : t('link.sendCode')}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <CodeInput code={codeInput.code} onChange={codeInput.setCode} />

            <div className="text-center text-[13px] text-ink-2">
              {t('link.notReceived')}{' '}
              {cooldown > 0 ? (
                <span className="text-ink-3">
                  {t('link.resendCooldown', { seconds: String(cooldown).padStart(2, '0') })}
                </span>
              ) : (
                <button
                  onClick={() => resend.mutate()}
                  disabled={resend.isPending}
                  className="font-semibold text-brand"
                >
                  {resend.isPending ? t('link.resending') : t('link.resend')}
                </button>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!codeInput.full || verify.isPending}
              onClick={() => verify.mutate({ code: codeInput.value })}
            >
              {verify.isPending ? t('link.verifying') : t('link.verifyAndLink')}
            </Button>
            <button
              onClick={() => {
                setStep('phone');
                codeInput.reset();
              }}
              className="w-full text-center text-[12.5px] font-semibold text-ink-3 hover:text-ink"
            >
              {t('link.changeNumber')}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
