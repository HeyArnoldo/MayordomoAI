import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Minus, PackagePlus, Pencil, Plus, TriangleAlert } from 'lucide-react';
import type { BoxBalance } from '@app/contracts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Money } from '@/components/mayordomo/money';
import { NewBoxDialog } from '@/features/boxes/new-box-dialog';
import { EditBoxDialog } from '@/features/boxes/edit-box-dialog';
import { useBoxBalances, useUpdateAllocation } from '@/hooks/use-finance';
import { boxColor } from '@/lib/boxes';
import { cn } from '@/lib/utils';

/** Editor de reparto del design: ±5%, validación de 100, aplica a futuros. */
export default function BoxesPage() {
  const { t } = useTranslation(['boxes', 'common']);
  const { data: boxes = [], isLoading } = useBoxBalances();
  const update = useUpdateAllocation();
  const [pcts, setPcts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<BoxBalance | null>(null);

  const editable = boxes.filter((b) => b.active && b.scope === 'personal');

  useEffect(() => {
    if (editable.length > 0 && Object.keys(pcts).length === 0) {
      setPcts(Object.fromEntries(editable.map((b) => [b.id, b.pct])));
    }
  }, [editable, pcts]);

  // Total sobre las cajas REALES (no solo el estado): una caja recién creada
  // cuenta aunque pcts aún no la tenga.
  const total = editable.reduce((s, b) => s + (pcts[b.id] ?? b.pct), 0);
  const ok = Math.round(total * 100) === 10000;
  const dirty = editable.some((b) => pcts[b.id] !== undefined && pcts[b.id] !== b.pct);

  const bump = (id: string, delta: number) =>
    setPcts((p) => ({ ...p, [id]: Math.min(100, Math.max(0, (p[id] ?? 0) + delta)) }));

  const save = () =>
    update.mutate(
      { items: editable.map((b) => ({ id: b.id, pct: pcts[b.id] ?? b.pct })) },
      {
        onSuccess: () => toast.success(t('editor.updated')),
        onError: (e) => toast.error(e.message),
      },
    );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <section
        className={cn(
          'flex items-center justify-between rounded-2xl border p-4 shadow-card',
          ok ? 'border-line bg-surface' : 'border-negative/40 bg-negative-soft',
        )}
      >
        <div className="flex items-center gap-2">
          {ok ? (
            <Check className="size-5 text-positive" />
          ) : (
            <TriangleAlert className="size-5 text-negative" />
          )}
          <span className={cn('text-sm font-bold', ok ? 'text-ink' : 'text-negative')}>
            {ok ? t('editor.sumOk') : t('editor.sumError', { total: total.toFixed(2) })}
          </span>
        </div>
        <Button size="sm" disabled={!ok || !dirty || update.isPending} onClick={save}>
          {t('common:save')}
        </Button>
      </section>

      <NewBoxDialog
        trigger={
          <Button variant="outline" className="w-full gap-2">
            <PackagePlus className="size-4" />
            {t('editor.newBox')}
          </Button>
        }
      />

      <section className="rounded-2xl border border-line bg-surface px-5 py-2 shadow-card">
        {editable.map((b, i) => {
          const color = boxColor(b.name, b.colorKey);
          const pct = pcts[b.id] ?? b.pct;
          return (
            <div
              key={b.id}
              className={cn(
                'flex items-center justify-between gap-3 py-3',
                i < editable.length - 1 && 'border-b border-line',
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-[13.5px] font-semibold text-ink">{b.name}</span>
                {b.accumulated !== null && (
                  <span className="rounded-full bg-surface-alt px-2 py-px text-[10.5px] font-bold text-ink-3">
                    {t('editor.fundBadge')}
                  </span>
                )}
                <button
                  onClick={() => setEditing(b)}
                  className="shrink-0 rounded-lg p-1 text-ink-3 transition-colors hover:bg-surface-alt hover:text-ink"
                  title={t('editor.editBox')}
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Money value={b.allocated} className="hidden text-xs text-ink-3 sm:inline" />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => bump(b.id, -5)}
                >
                  <Minus className="size-3.5" />
                </Button>
                {/* % editable a mano; los ± siguen para ajustes rápidos */}
                <div className="relative">
                  <input
                    value={pct}
                    inputMode="decimal"
                    onChange={(e) => {
                      const raw = e.target.value.replace(',', '.');
                      if (!/^\d{0,3}(\.\d{0,2})?$/.test(raw)) return;
                      const n = raw === '' ? 0 : parseFloat(raw);
                      if (n <= 100) setPcts((p) => ({ ...p, [b.id]: n }));
                    }}
                    className="money h-8 w-[64px] rounded-lg border border-line bg-surface pr-5 text-center text-sm font-semibold text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-ink-3">
                    %
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => bump(b.id, 5)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </section>

      <p className="text-center text-xs text-ink-3">{t('editor.futureNote')}</p>

      <EditBoxDialog box={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
