import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import type { Transaction } from '@app/contracts';
import { TransactionStatus, TransactionType } from '@app/contracts';
import { TransactionRow } from '@/components/mayordomo/transaction-row';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoxBalances, useTransactions, useVoidTransaction } from '@/hooks/use-finance';
import { cn } from '@/lib/utils';

const FILTERS = [
  { label: 'Todos', value: undefined },
  { label: 'Gastos', value: TransactionType.EXPENSE },
  { label: 'Ingresos', value: TransactionType.INCOME },
  { label: 'Tránsito', value: TransactionType.TRANSIT },
] as const;

/** Agrupa por fecha contable con etiquetas humanas (Hoy / Ayer / fecha). */
function dayLabel(date: string): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'America/Lima',
  });
  if (date === today) return 'Hoy';
  if (date === yesterday) return 'Ayer';
  const label = new Date(`${date}T12:00:00`).toLocaleDateString('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function TransactionsPage() {
  const [filter, setFilter] = useState<TransactionType | undefined>(undefined);
  const [toVoid, setToVoid] = useState<Transaction | null>(null);
  const { data: boxes = [] } = useBoxBalances();
  const params: Record<string, string | number | boolean> = {
    limit: 100,
    includeVoided: true,
  };
  if (filter) params.type = filter;
  const { data: txs = [], isLoading } = useTransactions(params);
  const voidTx = useVoidTransaction();

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of txs) {
      const list = map.get(tx.date) ?? [];
      list.push(tx);
      map.set(tx.date, list);
    }
    return [...map.entries()];
  }, [txs]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
              filter === f.value
                ? 'bg-brand text-on-brand'
                : 'border border-line bg-surface text-ink-2 hover:bg-surface-alt',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <Skeleton className="h-64 w-full rounded-2xl" />}

      {!isLoading && groups.length === 0 && (
        <p className="py-12 text-center text-sm text-ink-3">No hay movimientos con ese filtro.</p>
      )}

      {groups.map(([date, list]) => (
        <section
          key={date}
          className="rounded-2xl border border-line bg-surface px-5 py-2 shadow-card"
        >
          <div className="pt-3 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-3">
            {dayLabel(date)}
          </div>
          {list.map((tx, i) => (
            <div key={tx.id} className="group relative">
              <TransactionRow tx={tx} boxes={boxes} last={i === list.length - 1} />
              {tx.status !== TransactionStatus.VOIDED && (
                <button
                  onClick={() => setToVoid(tx)}
                  className="absolute -right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-3 opacity-0 transition-opacity hover:text-negative group-hover:opacity-100"
                  title="Anular"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </section>
      ))}

      <AlertDialog open={Boolean(toVoid)} onOpenChange={(open) => !open && setToVoid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              {toVoid?.note ?? 'Movimiento'} · S/{toVoid?.amount.toFixed(2)}. Queda visible como
              anulado y los saldos se recalculan. No se borra nada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toVoid) return;
                voidTx.mutate(toVoid.id, {
                  onSuccess: () => toast.success('Movimiento anulado'),
                  onError: (e) => toast.error(e.message),
                });
                setToVoid(null);
              }}
            >
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
