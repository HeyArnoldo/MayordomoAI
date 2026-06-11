import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { MessageCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { usersApi } from '@/services/users.api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CodeInput, useCodeInput } from './code-input';

const E164 = /^\+[1-9]\d{7,14}$/;
const RESEND_SECONDS = 60;
const PHONES_KEY = ['me', 'phones'] as const;

function apiError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string | string[] } | undefined)?.message;
    if (Array.isArray(msg)) return msg[0] ?? fallback;
    if (msg) return msg;
  }
  return fallback;
}

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
  const qc = useQueryClient();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [e164, setE164] = useState('+51');
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
    setE164('+51');
    codeInput.reset();
  };

  const link = useMutation({
    mutationFn: usersApi.linkPhone,
    onSuccess: (phone) => {
      invalidate();
      if (phone.verified) {
        toast.success('Ese número ya está verificado');
        close();
        return;
      }
      setStep('code');
      setCooldown(RESEND_SECONDS);
    },
    onError: (err) => toast.error(apiError(err, 'No se pudo registrar el número')),
  });

  const verify = useMutation({
    mutationFn: usersApi.verifyPhone,
    onSuccess: () => {
      invalidate();
      toast.success('Número verificado y vinculado');
      close();
    },
    onError: (err) => toast.error(apiError(err, 'Código incorrecto')),
  });

  const resend = useMutation({
    mutationFn: usersApi.resendCode,
    onSuccess: () => {
      toast.success('Código reenviado por WhatsApp');
      setCooldown(RESEND_SECONDS);
    },
    onError: (err) => toast.error(apiError(err, 'No se pudo reenviar')),
  });

  const valid = E164.test(e164);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-[18px] text-brand" />
            {changing ? 'Cambiar número de WhatsApp' : 'Vincular WhatsApp'}
          </DialogTitle>
          <DialogDescription>
            {step === 'phone'
              ? 'El número desde el que le escribes al mayordomo para anotar gastos.'
              : `Te enviamos un código de 6 dígitos por WhatsApp al ${e164}.`}
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
                    <ShieldCheck className="size-3.5" /> verificado
                  </span>
                ) : (
                  <span className="text-[11.5px] font-semibold text-warn">sin verificar</span>
                )}
              </div>
            )}

            <Input
              type="tel"
              inputMode="tel"
              autoFocus
              value={e164}
              onChange={(e) => setE164(e.target.value.replace(/[^\d+]/g, ''))}
              placeholder="+51 987 654 321"
              className="h-12 rounded-[14px] font-mono text-[15px] font-semibold"
            />
            <p className="text-[12px] text-ink-3">
              Formato internacional, ej.: +51987654321. Un número solo puede pertenecer a una
              cuenta.
            </p>

            {changing && (
              <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-3.5 py-2.5">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                <p className="text-[12px] leading-snug text-ink-2">
                  Al cambiar, tu número actual deja de funcionar con el bot HASTA que verifiques el
                  nuevo.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={!valid || link.isPending}>
              {link.isPending ? 'Enviando código…' : 'Enviar código por WhatsApp'}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <CodeInput code={codeInput.code} onChange={codeInput.setCode} />

            <div className="text-center text-[13px] text-ink-2">
              ¿No te llegó?{' '}
              {cooldown > 0 ? (
                <span className="text-ink-3">
                  Reenviar código (0:{String(cooldown).padStart(2, '0')})
                </span>
              ) : (
                <button
                  onClick={() => resend.mutate()}
                  disabled={resend.isPending}
                  className="font-semibold text-brand"
                >
                  {resend.isPending ? 'Reenviando…' : 'Reenviar código'}
                </button>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!codeInput.full || verify.isPending}
              onClick={() => verify.mutate({ code: codeInput.value })}
            >
              {verify.isPending ? 'Verificando…' : 'Verificar y vincular'}
            </Button>
            <button
              onClick={() => {
                setStep('phone');
                codeInput.reset();
              }}
              className="w-full text-center text-[12.5px] font-semibold text-ink-3 hover:text-ink"
            >
              Cambiar el número
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
