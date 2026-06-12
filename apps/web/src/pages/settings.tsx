import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Check,
  ChevronDown,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  resolveCurrency,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALES,
  UserRole,
  type Currency,
  type Locale,
} from '@app/contracts';
import { getIntlLocale } from '@app/i18n';
import { useMe } from '@/hooks/use-auth';
import { usersApi } from '@/services/users.api';
import { ACCENTS, applyAccent, getAccent, type AccentKey } from '@/lib/accent';
import { AgentTrail } from '@/features/agent/agent-trail';
import { PhoneLinkDialog } from '@/features/phone/phone-link-dialog';
import { DeleteAccountDialog } from '@/features/account/delete-account-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-[15px] font-bold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-[12.5px] text-ink-2">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Configuración: perfil, apariencia, WhatsApp, razonamiento y cuenta. */
export default function SettingsPage() {
  const { data: user } = useMe();
  const qc = useQueryClient();
  const [accent, setAccent] = useState<AccentKey>(() => getAccent());
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [trailOpen, setTrailOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const { data: phones = [] } = useQuery({ queryKey: ['me', 'phones'], queryFn: usersApi.phones });
  const phone = phones[0];

  const { t } = useTranslation(['settings', 'common']);

  const renameMutation = useMutation({
    mutationFn: usersApi.updateName,
    onSuccess: () => {
      setEditingName(false);
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: usersApi.updatePreferences,
    onSuccess: () => {
      toast.success(t('languageCurrency.updated'));
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: () => toast.error(t('languageCurrency.updateError')),
  });

  const submitName = () => {
    const name = nameDraft.trim();
    if (name.length < 2 || renameMutation.isPending) return;
    renameMutation.mutate({ name });
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Nombres de moneda localizados por Intl — sin strings que traducir a mano.
  const currencyNames = new Intl.DisplayNames(getIntlLocale(user.language), { type: 'currency' });

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {/* ── Perfil ── */}
      <Section title={t('profile.title')} description={t('profile.description')}>
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-14 rounded-full border border-line"
            />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full border border-line bg-brand-soft text-xl font-bold text-brand">
              {user.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={nameDraft}
                  maxLength={120}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="h-8 max-w-56 text-[14px]"
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-brand"
                  disabled={nameDraft.trim().length < 2 || renameMutation.isPending}
                  onClick={submitName}
                  aria-label={t('profile.saveName')}
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-ink-3"
                  onClick={() => setEditingName(false)}
                  aria-label={t('common:cancel')}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="truncate text-[15px] font-bold text-ink">{user.name}</span>
                {user.role === UserRole.ADMIN && (
                  <span className="rounded-full bg-brand-soft px-2 py-px text-[10.5px] font-bold text-brand">
                    {t('profile.adminBadge')}
                  </span>
                )}
                <button
                  onClick={() => {
                    setNameDraft(user.name);
                    setEditingName(true);
                  }}
                  className="text-ink-3 transition-colors hover:text-brand"
                  aria-label={t('profile.editName')}
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <div className="truncate text-[13px] text-ink-2">{user.email}</div>
            <div className="text-[11.5px] text-ink-3">
              {t('profile.memberSince', { date: memberSince })}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Apariencia ── */}
      <Section title={t('appearance.title')} description={t('appearance.description')}>
        <div className="flex gap-3">
          {ACCENTS.map((a) => {
            const selected = accent === a.key;
            return (
              <button
                key={a.key}
                onClick={() => {
                  applyAccent(a.key);
                  setAccent(a.key);
                }}
                className={cn(
                  'flex flex-1 flex-col items-center gap-2 rounded-xl border p-3 transition-colors',
                  selected
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-surface hover:bg-surface-alt',
                )}
              >
                <span
                  className="flex size-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: a.swatch }}
                >
                  {selected && <Check className="size-4 text-white" />}
                </span>
                <span
                  className={cn(
                    'text-[12.5px] font-semibold',
                    selected ? 'text-brand' : 'text-ink-2',
                  )}
                >
                  {t(a.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Idioma y moneda ── */}
      <Section title={t('languageCurrency.title')} description={t('languageCurrency.description')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-ink-2">
              {t('languageCurrency.languageLabel')}
            </label>
            <Select
              value={user.language}
              onValueChange={(v) => preferencesMutation.mutate({ language: v as Locale })}
              disabled={preferencesMutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LOCALES.map((locale) => (
                  <SelectItem key={locale} value={locale}>
                    {t(`languages.${locale}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-ink-2">
              {t('languageCurrency.currencyLabel')}
            </label>
            <Select
              value={resolveCurrency(user.currency)}
              onValueChange={(v) => preferencesMutation.mutate({ currency: v as Currency })}
              disabled={preferencesMutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency} — {currencyNames.of(currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-3 text-[11.5px] text-ink-3">{t('languageCurrency.currencyWarning')}</p>
      </Section>

      {/* ── WhatsApp ── */}
      <Section title={t('whatsapp.title')} description={t('whatsapp.description')}>
        <div className="flex flex-wrap items-center gap-3">
          {phone ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-alt/60 px-3.5 py-2.5">
              <span className="font-mono text-[13.5px] font-semibold text-ink">{phone.e164}</span>
              {phone.verified ? (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand">
                  <ShieldCheck className="size-3.5" /> {t('whatsapp.verified')}
                </span>
              ) : (
                <span className="text-[11.5px] font-semibold text-warn">
                  {t('whatsapp.unverified')}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-ink-2">{t('whatsapp.noPhone')}</p>
          )}
          <Button variant="outline" className="gap-2" onClick={() => setPhoneOpen(true)}>
            <MessageCircle className="size-4" />
            {phone?.verified ? t('whatsapp.changeNumber') : t('whatsapp.link')}
          </Button>
        </div>
      </Section>

      {/* ── Razonamiento del agente ── */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <button
          onClick={() => setTrailOpen((o) => !o)}
          className="flex w-full items-center justify-between"
        >
          <div className="text-left">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
              <Wrench className="size-4 text-brand" /> {t('trail.title')}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-2">{t('trail.description')}</p>
          </div>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-ink-3 transition-transform',
              trailOpen && 'rotate-180',
            )}
          />
        </button>
        {trailOpen && (
          <div className="mt-4">
            <AgentTrail />
          </div>
        )}
      </section>

      {/* ── Cuenta ── */}
      <Section title={t('account.title')} description={t('account.description')}>
        <Button
          variant="ghost"
          className="gap-2 bg-negative-soft font-semibold text-negative hover:bg-negative-soft/80 hover:text-negative"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" /> {t('account.delete')}
        </Button>
      </Section>

      <PhoneLinkDialog open={phoneOpen} onOpenChange={setPhoneOpen} />
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
