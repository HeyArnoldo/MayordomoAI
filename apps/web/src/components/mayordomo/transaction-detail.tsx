import { ArrowDown, ArrowUp, ArrowUpDown, Mic, Trash2, X } from 'lucide-react';
import type { BoxBalance, Transaction } from '@app/contracts';
import { TransactionSource, TransactionStatus, TransactionType } from '@app/contracts';
import { Money } from '@/components/mayordomo/money';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { boxColor } from '@/lib/boxes';
import { cn } from '@/lib/utils';

const SOURCE_LABELS: Record<TransactionSource, string> = {
  [TransactionSource.WHATSAPP]: 'WhatsApp',
  [TransactionSource.PWA]: 'PWA web',
  [TransactionSource.IMPORT]: 'Importado',
};

function fechaLabel(tx: Transaction): string {
  const fecha = new Date(`${tx.date}T12:00:00`).toLocaleDateString('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const hora = new Date(tx.occurredAt).toLocaleTimeString('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${fecha.charAt(0).toUpperCase()}${fecha.slice(1)} · ${hora}`;
}

/**
 * Detalle de movimiento del design (MovDetalleScreen): hero con monto,
 * reparto si fue ingreso, filas de metadata y Anular (soft delete).
 */
export function TransactionDetailDialog({
  tx,
  boxes,
  onClose,
  onVoid,
}: {
  tx: Transaction | null;
  boxes: BoxBalance[];
  onClose: () => void;
  onVoid: (tx: Transaction) => void;
}) {
  if (!tx) return null;

  const box = boxes.find((b) => b.id === tx.boxId);
  const isIncome = tx.type === TransactionType.INCOME;
  const isTransit = tx.type === TransactionType.TRANSIT;
  const voided = tx.status === TransactionStatus.VOIDED;
  const color = box
    ? boxColor(box.name, box.colorKey)
    : isIncome
      ? 'var(--positive)'
      : 'var(--ink-3)';
  const Icon = isIncome ? ArrowDown : isTransit ? ArrowUpDown : ArrowUp;

  const rows: Array<[string, string]> = [
    ['Tipo', isIncome ? 'Ingreso' : isTransit ? 'Tránsito' : 'Gasto'],
    ['Caja', box?.name ?? '—'],
    ['Fecha', fechaLabel(tx)],
    ['Origen', SOURCE_LABELS[tx.source]],
    ['Estado', voided ? 'Anulado' : 'Confirmado'],
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[85dvh] max-w-sm gap-3 overflow-y-auto bg-background p-4"
      >
        <DialogTitle className="sr-only">Detalle del movimiento</DialogTitle>

        {/* cerrar: botón circular del design, sticky para sobrevivir al scroll */}
        <button
          onClick={onClose}
          className="sticky top-0 z-10 ml-auto flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-card transition-colors hover:bg-surface-alt hover:text-ink"
          title="Cerrar"
        >
          <X className="size-4" />
        </button>

        {/* hero: monto grande con el color de la caja */}
        <div className="flex flex-col items-center rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
          <div
            className="mb-3 flex size-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 11%, transparent)` }}
          >
            <Icon className="size-6" style={{ color }} />
          </div>
          <Money
            value={tx.amount}
            sign={isIncome ? '+' : isTransit ? '↔' : '−'}
            className={cn(
              'text-[38px]',
              isIncome ? 'text-positive' : 'text-ink',
              voided && 'line-through opacity-60',
            )}
          />
          <div className="mt-2 text-[15px] font-semibold text-ink">
            {tx.note ?? box?.name ?? '—'}
          </div>
          {tx.voice && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-[11.5px] font-semibold text-ink-2">
              <Mic className="size-3" /> nota de voz
            </span>
          )}
        </div>

        {/* reparto inmutable del ingreso (snapshot, no % actuales) */}
        {tx.split && tx.split.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="mb-3 font-mono text-[11px] font-medium tracking-widest text-ink-3 uppercase">
              Reparto de este ingreso
            </div>
            <div className="flex flex-col gap-2">
              {tx.split.map((s) => (
                <div key={s.boxId} className="flex items-center gap-2.5">
                  <span
                    className="size-2.5 rounded-[3px]"
                    style={{
                      backgroundColor: boxColor(
                        s.name,
                        boxes.find((b) => b.id === s.boxId)?.colorKey,
                      ),
                    }}
                  />
                  <span className="flex-1 text-[12.5px] text-ink-2">
                    {s.name} <span className="text-ink-3">· {s.pct}%</span>
                  </span>
                  <Money value={s.amount} className="text-[12px] font-medium" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* metadata en filas */}
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {rows.map(([k, v], i) => (
            <div
              key={k}
              className={cn(
                'flex items-center justify-between px-4 py-3',
                i < rows.length - 1 && 'border-b border-line',
              )}
            >
              <span className="text-[12.5px] text-ink-2">{k}</span>
              <span className="text-[13px] font-semibold text-ink">{v}</span>
            </div>
          ))}
        </div>

        {!voided && (
          <Button
            variant="ghost"
            className="w-full bg-negative-soft font-semibold text-negative hover:bg-negative-soft/80 hover:text-negative"
            onClick={() => onVoid(tx)}
          >
            <Trash2 className="size-4" /> Anular movimiento
          </Button>
        )}
        <p className="text-center text-[11.5px] leading-relaxed text-ink-3">
          Los movimientos no se borran: se marcan como anulados y el saldo se recalcula.
        </p>
      </DialogContent>
    </Dialog>
  );
}
