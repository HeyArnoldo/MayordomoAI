import { TrendingUp } from 'lucide-react';
import type { BoxBalance } from '@app/contracts';
import { Money } from '@/components/mayordomo/money';
import { boxAlert, boxColor } from '@/lib/boxes';
import { cn } from '@/lib/utils';

/** Fila de caja con barra de uso y alertas por excepción (design: CajaRow). */
export function BoxRow({ box, last = false }: { box: BoxBalance; last?: boolean }) {
  const color = boxColor(box.name);
  const isFund = box.accumulated !== null;
  const pctUsed = box.allocated > 0 ? (box.spent / box.allocated) * 100 : 0;
  const alert = boxAlert(box);

  return (
    <div className={cn('py-3', !last && 'border-b border-line')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[13.5px] font-semibold text-ink">{box.name}</span>
          <span className="money text-[11px] text-ink-3">{box.pct}%</span>
          {alert && (
            <span
              className={cn(
                'rounded-full px-2 py-px text-[10.5px] font-bold',
                alert.tone === 'danger' && 'bg-negative-soft text-negative',
                alert.tone === 'warn' && 'bg-warn/15 text-warn',
                alert.tone === 'muted' && 'bg-surface-alt text-ink-3',
              )}
            >
              {alert.label}
            </span>
          )}
        </div>
        {isFund ? (
          <span className="flex items-center gap-1">
            <TrendingUp className="size-3.5" style={{ color }} />
            <Money value={box.accumulated!} className="text-sm" />
          </span>
        ) : (
          <Money
            value={box.balance}
            className={cn('text-sm', box.balance < 0 && 'text-negative')}
          />
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-alt">
        <div
          className="h-full rounded-full transition-all duration-400"
          style={{
            width: `${Math.min(isFund ? 100 : pctUsed, 100)}%`,
            backgroundColor: box.balance < 0 ? 'var(--negative)' : color,
          }}
        />
      </div>
    </div>
  );
}
