import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, MessageCircle, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import { UserRole } from '@app/contracts';
import { useMe } from '@/hooks/use-auth';
import { usersApi } from '@/services/users.api';
import { ACCENTS, applyAccent, getAccent, type AccentKey } from '@/lib/accent';
import { AgentTrail } from '@/features/agent/agent-trail';
import { PhoneLinkDialog } from '@/features/phone/phone-link-dialog';
import { DeleteAccountDialog } from '@/features/account/delete-account-dialog';
import { Button } from '@/components/ui/button';
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
  const [accent, setAccent] = useState<AccentKey>(() => getAccent());
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [trailOpen, setTrailOpen] = useState(false);

  const { data: phones = [] } = useQuery({ queryKey: ['me', 'phones'], queryFn: usersApi.phones });
  const phone = phones[0];

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

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {/* ── Perfil ── */}
      <Section title="Perfil" description="Tus datos vienen de tu cuenta de Google.">
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
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-bold text-ink">{user.name}</span>
              {user.role === UserRole.ADMIN && (
                <span className="rounded-full bg-brand-soft px-2 py-px text-[10.5px] font-bold text-brand">
                  admin
                </span>
              )}
            </div>
            <div className="truncate text-[13px] text-ink-2">{user.email}</div>
            <div className="text-[11.5px] text-ink-3">Miembro desde el {memberSince}</div>
          </div>
        </div>
      </Section>

      {/* ── Apariencia ── */}
      <Section title="Apariencia" description="El acento cambia el color principal de toda la app.">
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
                  {a.label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── WhatsApp ── */}
      <Section
        title="WhatsApp"
        description="El número desde el que le escribes al mayordomo para anotar gastos."
      >
        <div className="flex flex-wrap items-center gap-3">
          {phone ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-alt/60 px-3.5 py-2.5">
              <span className="font-mono text-[13.5px] font-semibold text-ink">{phone.e164}</span>
              {phone.verified ? (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand">
                  <ShieldCheck className="size-3.5" /> verificado
                </span>
              ) : (
                <span className="text-[11.5px] font-semibold text-warn">sin verificar</span>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-ink-2">Sin número vinculado todavía.</p>
          )}
          <Button variant="outline" className="gap-2" onClick={() => setPhoneOpen(true)}>
            <MessageCircle className="size-4" />
            {phone?.verified ? 'Cambiar número' : 'Vincular WhatsApp'}
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
              <Wrench className="size-4 text-brand" /> Historial de razonamiento
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-2">
              Cada paso del agente auditado: herramienta, argumentos y resultado.
            </p>
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
      <Section
        title="Cuenta"
        description="Eliminar tu cuenta borra todos tus datos y libera tu número de WhatsApp."
      >
        <Button
          variant="ghost"
          className="gap-2 bg-negative-soft font-semibold text-negative hover:bg-negative-soft/80 hover:text-negative"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" /> Eliminar mi cuenta
        </Button>
      </Section>

      <PhoneLinkDialog open={phoneOpen} onOpenChange={setPhoneOpen} />
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
