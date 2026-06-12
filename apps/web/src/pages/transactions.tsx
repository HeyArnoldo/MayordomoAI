import { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import type { Transaction } from '@app/contracts';
import { TransactionType } from '@app/contracts';
import { TransactionRow } from '@/components/mayordomo/transaction-row';
import { TransactionDetailDialog } from '@/components/mayordomo/transaction-detail';
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
import { boxColor } from '@/lib/boxes';
import { cn } from '@/lib/utils';

const FILTERS = [
  { labelKey: 'filters.all', value: undefined },
  { labelKey: 'filters.expenses', value: TransactionType.EXPENSE },
  { labelKey: 'filters.income', value: TransactionType.INCOME },
  { labelKey: 'filters.transit', value: TransactionType.TRANSIT },
] as const;

/** Agrupa por fecha contable con etiquetas humanas (Hoy / Ayer / fecha). */
function dayLabel(date: string, t: TFunction<readonly ['transactions', 'common']>): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'America/Lima',
  });
  if (date === today) return t('dates.today');
  if (date === yesterday) return t('dates.yesterday');
  const label = new Date(`${date}T12:00:00`).toLocaleDateString('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function TransactionsPage() {
  const { t } = useTranslation(['transactions', 'common']);
  const [filter, setFilter] = useState<TransactionType | undefined>(undefined);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [toVoid, setToVoid] = useState<Transaction | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: boxes = [] } = useBoxBalances();

  // Historial de UNA caja: se llega con /movimientos?box=<id> (click en el sobre).
  const boxId = searchParams.get('box');
  const activeBox = boxId ? boxes.find((b) => b.id === boxId) : undefined;

  const params: Record<string, string | number | boolean> = {
    limit: 100,
    includeVoided: true,
  };
  if (filter) params.type = filter;
  if (boxId) params.boxId = boxId;
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
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.labelKey}
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
              filter === f.value
                ? 'bg-brand text-on-brand'
                : 'border border-line bg-surface text-ink-2 hover:bg-surface-alt',
            )}
          >
            {t(f.labelKey)}
          </button>
        ))}

        {/* chip de la caja activa, con su color y quitable */}
        {activeBox && (
          <button
            onClick={() => setSearchParams({}, { replace: true })}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1.5 pr-2.5 pl-3 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-alt"
            title={t('list.removeBoxFilter')}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: boxColor(activeBox.name, activeBox.colorKey) }}
            />
            {activeBox.name}
            <X className="size-3.5 text-ink-3" />
          </button>
        )}
      </div>

      {isLoading && <Skeleton className="h-64 w-full rounded-2xl" />}

      {!isLoading && groups.length === 0 && (
        <p className="py-12 text-center text-sm text-ink-3">
          {activeBox ? t('list.emptyBox', { box: activeBox.name }) : t('list.emptyFilter')}
        </p>
      )}

      {groups.map(([date, list]) => (
        <section
          key={date}
          className="rounded-2xl border border-line bg-surface px-5 py-2 shadow-card"
        >
          <div className="pt-3 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-3">
            {dayLabel(date, t)}
          </div>
          {list.map((tx, i) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              boxes={boxes}
              last={i === list.length - 1}
              onClick={() => setSelected(tx)}
            />
          ))}
        </section>
      ))}

      {/* Detalle del movimiento (design: MovDetalleScreen). Anular vive aquí. */}
      <TransactionDetailDialog
        tx={selected}
        boxes={boxes}
        onClose={() => setSelected(null)}
        onVoid={(tx) => {
          setSelected(null);
          setToVoid(tx);
        }}
      />

      <AlertDialog open={Boolean(toVoid)} onOpenChange={(open) => !open && setToVoid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('void.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {toVoid?.note ?? t('void.fallbackNote')} · S/{toVoid?.amount.toFixed(2)}.{' '}
              {t('void.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toVoid) return;
                voidTx.mutate(toVoid.id, {
                  onSuccess: () => toast.success(t('void.success')),
                  onError: (e) => toast.error(e.message),
                });
                setToVoid(null);
              }}
            >
              {t('void.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
