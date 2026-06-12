import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Sparkles } from 'lucide-react';
import { loginSchema, type LoginInput } from '@app/contracts';
import { useAuthConfig, useLogin, useMe } from '@/hooks/use-auth';
import { googleAuthUrl } from '@/services/auth.api';
import {
  AuthShell,
  EnvelopeChip,
  GoogleButton,
  MobileBrandHeader,
} from '@/components/mayordomo/auth-shell';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const CAJAS_LOGIN = ['ahorro', 'pasajes', 'ocio', 'diezmo'];

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const { data: me } = useMe();
  const { data: config } = useAuthConfig();
  const login = useLogin();
  const navigate = useNavigate();
  const [showLocal, setShowLocal] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (me) return <Navigate to="/" replace />;

  const onSubmit = (input: LoginInput) => {
    login.mutate(input, {
      onSuccess: () => navigate('/'),
      onError: () => toast.error(t('login.invalidCredentials')),
    });
  };

  return (
    <AuthShell>
      <div className="flex flex-col">
        <MobileBrandHeader />

        {/* preview de cajitas — solo mobile, como en el design */}
        <div className="mt-9 mb-9 flex justify-center gap-2 lg:hidden">
          {CAJAS_LOGIN.map((id) => (
            <EnvelopeChip key={id} caja={id} />
          ))}
        </div>

        <div className="hidden lg:block">
          <h2 className="text-[26px] font-bold tracking-tight text-ink">{t('login.title')}</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{t('login.subtitle')}</p>
        </div>

        {config?.googleEnabled && (
          <div className="mt-0 lg:mt-7">
            <GoogleButton href={googleAuthUrl} />
          </div>
        )}

        {config?.localEnabled && (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="font-mono text-[11.5px] text-ink-3">{t('login.or')}</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            {showLocal ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('login.emailLabel')}</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder={t('login.emailPlaceholder')}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('login.passwordLabel')}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={login.isPending}>
                    {login.isPending ? t('login.submitting') : t('login.submit')}
                  </Button>
                </form>
              </Form>
            ) : (
              <button
                onClick={() => setShowLocal(true)}
                className="text-center text-[13px] font-semibold text-ink-2 hover:text-ink"
              >
                {t('login.showLocal')}
              </button>
            )}

            <p className="mt-4 text-center text-sm text-ink-3">
              {t('login.noAccount')}{' '}
              <Link to="/register" className="font-semibold text-brand">
                {t('login.registerLink')}
              </Link>
            </p>
          </>
        )}

        {/* card de lista de espera del design */}
        <div className="mt-6 flex items-start gap-3 rounded-[14px] border border-line bg-surface p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-brand-soft text-brand">
            <Sparkles className="size-[17px]" />
          </div>
          <div>
            <div className="text-[13.5px] font-semibold text-ink">
              {t('login.waitlistCardTitle')}
            </div>
            <div className="mt-0.5 text-[12.5px] text-ink-2">{t('login.waitlistCardBody')}</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          <Check className="size-[13px] text-ink-3" />
          <span className="text-[12px] text-ink-3">{t('login.inviteOnly')}</span>
        </div>
      </div>
    </AuthShell>
  );
}
