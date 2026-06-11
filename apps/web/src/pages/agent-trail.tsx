import { Wrench } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToolAudits } from '@/hooks/use-finance';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
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
 * argumentos y qué devolvió. Replayability — el usuario puede auditar paso a
 * paso por qué el agente respondió lo que respondió.
 */
export default function AgentTrailPage() {
  const { data: audits = [], isLoading } = useToolAudits();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="text-lg font-bold text-ink">Historial de razonamiento</h1>
        <p className="text-sm text-ink-2">
          Cada paso del agente queda auditado: herramienta, argumentos y resultado. Nada se inventa
          — todo es trazable.
        </p>
      </header>

      {isLoading && <Skeleton className="h-64 w-full rounded-2xl" />}

      {!isLoading && audits.length === 0 && (
        <p className="py-12 text-center text-sm text-ink-3">
          Aún no hay actividad del agente. Pregúntale algo en el chat.
        </p>
      )}

      <div className="space-y-2">
        {audits.map((a) => (
          <article
            key={a.id}
            className="rounded-xl border border-line bg-surface p-3.5 shadow-card"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-mono text-[12.5px] font-semibold text-brand">
                <Wrench className="size-3.5" /> {a.tool}
              </span>
              <span className="font-mono text-[10.5px] text-ink-3">{timeLabel(a.createdAt)}</span>
            </div>
            <dl className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed">
              <div className="flex gap-2">
                <dt className="shrink-0 uppercase tracking-wider text-ink-3">args</dt>
                <dd className="break-all text-ink-2">{compact(a.args)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 uppercase tracking-wider text-ink-3">out </dt>
                <dd className="break-all text-ink-2">{compact(a.result)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
