import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { mapBrowserLanguage, registerSchema, type RegisterInput } from '@app/contracts';
import { useAuthConfig, useMe, useRegister } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const { data: me } = useMe();
  const { data: config } = useAuthConfig();
  const register = useRegister();
  const navigate = useNavigate();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  if (me) return <Navigate to="/" replace />;
  // Registro local apagado (proyecto solo-Google): no existe esta página.
  if (config && !config.localEnabled) return <Navigate to="/login" replace />;

  const onSubmit = (input: RegisterInput) => {
    // Idioma derivado del navegador (es/en; otro → en) — queda persistido en la cuenta.
    register.mutate(
      { ...input, language: mapBrowserLanguage(navigator.language) },
      {
        onSuccess: () => navigate('/'),
        onError: () => toast.error(t('register.createError')),
      },
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('register.title')}</CardTitle>
          <CardDescription>{t('register.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('register.nameLabel')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('register.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('register.emailLabel')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t('register.emailPlaceholder')} {...field} />
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
                    <FormLabel>{t('register.passwordLabel')}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={register.isPending}>
                {register.isPending ? t('register.submitting') : t('register.submit')}
              </Button>
            </form>
          </Form>
          <p className="text-center text-sm text-muted-foreground">
            {t('register.haveAccount')}{' '}
            <Link to="/login" className="underline">
              {t('register.loginLink')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
