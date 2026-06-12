import { Trans, useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react';
import type { BoxBalance } from '@app/contracts';
import { Money } from '@/components/mayordomo/money';
import { boxColor } from '@/lib/boxes';
import { cn } from '@/lib/utils';

/**
 * La metáfora central del design: card con SOLAPA de sobre — banda superior
 * con clip-path triangular en el color de la caja (docs/design/ui/tokens.jsx).
 */
export function EnvelopeCard({
  box,
  compact = false,
  onClick,
}: {
  box: BoxBalance;
  compact?: boolean;
  onClick?: () => void;
}) {
  const { t } = useTranslation('boxes');
  const color = boxColor(box.name, box.colorKey);
  const isFund = box.accumulated !== null;
  const over = box.balance < 0;
  const pctUsed = box.allocated > 0 ? (box.spent / box.allocated) * 100 : 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card',
        onClick && 'cursor-pointer',
      )}
    >
      {/* solapa del sobre */}
      <div
        className="relative"
        style={{
          height: compact ? 17 : 26,
          backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 28%, 50% 100%, 0 28%)',
            backgroundColor: `color-mix(in srgb, ${color} 26%, transparent)`,
          }}
        />
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: color }} />
      </div>

      <div className={compact ? 'px-3 pb-2.5 pt-2' : 'px-3.5 pb-3.5 pt-3'}>
        <div className="flex items-center justify-between gap-2">
          <span className={cn('font-semibold text-ink', compact ? 'text-[13.5px]' : 'text-sm')}>
            {box.name}
          </span>
          <span className="money text-[11px] text-ink-3">{box.pct}%</span>
        </div>

        <div className={compact ? 'mt-0.5' : 'mt-1.5'}>
          {isFund ? (
            <Money value={box.accumulated!} className="text-xl" style={{ color }} />
          ) : (
            <Money value={box.balance} className={cn('text-xl', over && 'text-negative')} />
          )}
        </div>

        <div className={compact ? 'mt-1.5' : 'mt-2.5'}>
          {isFund ? (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="size-3" style={{ color }} />
              <span className="text-[11.5px] text-ink-2">
                <Trans
                  t={t}
                  i18nKey="card.fundAccumulates"
                  components={{
                    amount: <Money value={box.allocated} sign="+" />,
                  }}
                />
              </span>
            </div>
          ) : (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
                <div
                  className="h-full rounded-full transition-all duration-400"
                  style={{
                    width: `${Math.min(pctUsed, 100)}%`,
                    backgroundColor: over ? 'var(--negative)' : color,
                  }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span
                  className={cn('text-[11px]', over ? 'font-bold text-negative' : 'text-ink-2')}
                >
                  {over ? t('alerts.overdraft') : t('card.usedPct', { pct: Math.round(pctUsed) })}
                </span>
                <span className="money text-[10.5px] text-ink-3">
                  <Trans
                    t={t}
                    i18nKey="card.ofAllocated"
                    components={{
                      amount: <Money value={box.allocated} />,
                    }}
                  />
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
