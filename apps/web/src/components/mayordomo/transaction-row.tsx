import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Mic } from 'lucide-react';
import type { BoxBalance, Transaction } from '@app/contracts';
import { TransactionStatus, TransactionType } from '@app/contracts';
import type { Locale } from '@app/contracts';
import { getIntlLocale } from '@app/i18n';
import { Money } from '@/components/mayordomo/money';
import { useLocale } from '@/hooks/use-locale';
import { boxColor } from '@/lib/boxes';
import { cn } from '@/lib/utils';

function timeLabel(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleTimeString(getIntlLocale(locale), {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Fila de movimiento del design: ícono por tipo, nota, caja coloreada, monto. */
export function TransactionRow({
  tx,
  boxes,
  last = false,
  onClick,
}: {
  tx: Transaction;
  boxes: BoxBalance[];
  last?: boolean;
  onClick?: () => void;
}) {
  const { t } = useTranslation('transactions');
  const locale = useLocale();
  const box = boxes.find((b) => b.id === tx.boxId);
  const isIncome = tx.type === TransactionType.INCOME;
  const voided = tx.status === TransactionStatus.VOIDED;
  const color = box
    ? boxColor(box.name, box.colorKey)
    : isIncome
      ? 'var(--positive)'
      : 'var(--ink-3)';
  const Icon = isIncome ? ArrowDown : ArrowUp;
  // Legacy voided transit rows have no box — show generic expense label as fallback.
  const label = box?.name ?? (isIncome ? t('types.income') : t('types.expense'));

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 py-3',
        !last && 'border-b border-line',
        voided && 'opacity-45',
        onClick && 'cursor-pointer',
      )}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
      >
        <Icon className="size-4" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate text-[13.5px] font-semibold text-ink',
              voided && 'line-through',
            )}
          >
            {tx.note ?? label}
          </span>
          {tx.voice && <Mic className="size-3 shrink-0 text-ink-3" />}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px]">
          <span className="font-semibold" style={{ color }}>
            {label}
          </span>
          <span className="text-ink-3">·</span>
          <span className="text-ink-3">{timeLabel(tx.occurredAt, locale)}</span>
          {voided && (
            <span className="rounded-full bg-surface-alt px-2 py-px font-semibold text-ink-3">
              {t('row.voided')}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <Money
          value={tx.amount}
          sign={isIncome ? '+' : '−'}
          className={cn('text-sm', isIncome ? 'text-positive' : 'text-ink')}
        />
        {tx.split && (
          <div className="text-[10.5px] text-ink-3">
            {t('row.splitAcross', { count: tx.split.length })}
          </div>
        )}
      </div>
    </div>
  );
}
