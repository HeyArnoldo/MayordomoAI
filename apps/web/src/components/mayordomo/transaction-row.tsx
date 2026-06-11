import { ArrowDown, ArrowUp, ArrowUpDown, Mic } from 'lucide-react';
import type { BoxBalance, Transaction } from '@app/contracts';
import { TransactionStatus, TransactionType } from '@app/contracts';
import { Money } from '@/components/mayordomo/money';
import { boxColor } from '@/lib/boxes';
import { cn } from '@/lib/utils';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
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
  const box = boxes.find((b) => b.id === tx.boxId);
  const isIncome = tx.type === TransactionType.INCOME;
  const isTransit = tx.type === TransactionType.TRANSIT;
  const voided = tx.status === TransactionStatus.VOIDED;
  const color = box ? boxColor(box.name) : isIncome ? 'var(--positive)' : 'var(--ink-3)';
  const Icon = isIncome ? ArrowDown : isTransit ? ArrowUpDown : ArrowUp;
  const label = box?.name ?? (isIncome ? 'Ingreso' : 'Tránsito');

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
          <span className="text-ink-3">{timeLabel(tx.occurredAt)}</span>
          {voided && (
            <span className="rounded-full bg-surface-alt px-2 py-px font-semibold text-ink-3">
              anulado
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <Money
          value={tx.amount}
          sign={isIncome ? '+' : isTransit ? '↔' : '−'}
          className={cn(
            'text-sm',
            isIncome ? 'text-positive' : isTransit ? 'text-ink-2' : 'text-ink',
          )}
        />
        {tx.split && (
          <div className="text-[10.5px] text-ink-3">repartido en {tx.split.length} cajas</div>
        )}
      </div>
    </div>
  );
}
