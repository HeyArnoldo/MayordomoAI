import { useTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react';
import type { Locale } from '@app/contracts';
import { getIntlLocale } from '@app/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/hooks/use-locale';
import { useToolAudits } from '@/hooks/use-finance';

function timeLabel(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(getIntlLocale(locale), {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function compact(value: unknown): string {
  const json = JSON.stringify(value);
  if (!json || json === '{}' || json === 'null') return '—';
  return json.length > 140 ? `${json.slice(0, 137)}…` : json;
}

/**
 * Historial de razonamiento: cada herramienta que llamó el agente, con qué
 * argumentos y qué devolvió. Replayability — auditable paso a paso.
 */
export function AgentTrail() {
  const { t } = useTranslation('chat');
  const locale = useLocale();
  const { data: audits = [], isLoading } = useToolAudits();

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  if (audits.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-3">{t('agent.empty')}</p>;
  }

  return (
    <div className="space-y-2">
      {audits.map((a) => (
        <article key={a.id} className="rounded-xl border border-line bg-surface p-3.5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-mono text-[12.5px] font-semibold text-brand">
              <Wrench className="size-3.5" /> {a.tool}
            </span>
            <span className="font-mono text-[10.5px] text-ink-3">
              {timeLabel(a.createdAt, locale)}
            </span>
          </div>
          <dl className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed">
            <div className="flex gap-2">
              <dt className="shrink-0 tracking-wider text-ink-3 uppercase">args</dt>
              <dd className="break-all text-ink-2">{compact(a.args)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 tracking-wider text-ink-3 uppercase">out </dt>
              <dd className="break-all text-ink-2">{compact(a.result)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
