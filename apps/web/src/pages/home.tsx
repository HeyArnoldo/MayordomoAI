import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, TrendingUp } from 'lucide-react';
import { Money } from '@/components/mayordomo/money';
import { EnvelopeCard } from '@/components/mayordomo/envelope-card';
import { TransactionRow } from '@/components/mayordomo/transaction-row';
import { RegistroDialog } from '@/features/registro/registro-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoxBalances, useTransactions } from '@/hooks/use-finance';
import { boxColor, monthLabel } from '@/lib/boxes';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: boxes = [], isLoading } = useBoxBalances();
  const { data: recent = [] } = useTransactions({ limit: 5 });
  // Click en una caja → su historial de movimientos filtrado.
  const goToBox = (id: string) => navigate(`/movimientos?box=${id}`);

  // El dashboard personal: la caja de ámbito empresa va aparte (design).
  const personal = boxes.filter((b) => b.active && b.scope === 'personal');
  const business = boxes.filter((b) => b.active && b.scope === 'business');
  const expenseBoxes = personal.filter((b) => b.accumulated === null);
  const funds = personal.filter((b) => b.accumulated !== null);
  const available = expenseBoxes.reduce((s, b) => s + b.balance, 0);
  const allocated = expenseBoxes.reduce((s, b) => s + b.allocated, 0);
  const usedPct = allocated > 0 ? ((allocated - available) / allocated) * 100 : 0;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      {/* Hero: lo disponible del mes, sin ruido */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink-3">
            Disponible · {monthLabel()}
          </span>
          <RegistroDialog
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" /> Registrar
              </Button>
            }
          />
        </div>
        <div className="mt-2">
          <Money value={available} className="text-4xl" />
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-alt">
          <div
            className="h-full rounded-full bg-brand transition-all duration-400"
            style={{ width: `${Math.min(usedPct, 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-3">
          Usado {Math.round(usedPct)}% de <span className="money">S/{allocated.toFixed(2)}</span>{' '}
          asignados
        </p>
      </section>

      {/* Spotlight de fondos (Ahorro) */}
      {funds.map((fund) => (
        <section
          key={fund.id}
          onClick={() => goToBox(fund.id)}
          className="flex cursor-pointer items-center justify-between rounded-2xl border border-line bg-surface p-5 shadow-card transition-colors hover:bg-surface-alt"
        >
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp
                className="size-4"
                style={{ color: boxColor(fund.name, fund.colorKey) }}
              />
              <span className="text-sm font-bold text-ink">{fund.name}</span>
            </div>
            <p className="mt-1 text-xs text-ink-2">
              Fondo · acumula <span className="money">+S/{fund.allocated.toFixed(2)}</span> este mes
            </p>
          </div>
          <Money value={fund.accumulated!} className="text-2xl" />
        </section>
      ))}

      {/* Las cajas como sobres — la metáfora central del design */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink-3">
            Tus cajas
          </span>
          <Link to="/cajas" className="flex items-center gap-1 text-xs font-semibold text-brand">
            Editar % <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {expenseBoxes.map((b) => (
            <EnvelopeCard key={b.id} box={b} onClick={() => goToBox(b.id)} />
          ))}
        </div>
      </section>

      {/* Ámbito empresa, separado del reparto personal */}
      {business.length > 0 && (
        <section>
          <div className="mb-2 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-3">
            Ámbito empresa
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {business.map((b) => (
              <EnvelopeCard key={b.id} box={b} onClick={() => goToBox(b.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Recientes */}
      <section className="rounded-2xl border border-line bg-surface px-5 py-2 shadow-card">
        <div className="flex items-center justify-between pt-3">
          <span className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink-3">
            Recientes
          </span>
          <Link
            to="/movimientos"
            className="flex items-center gap-1 text-xs font-semibold text-brand"
          >
            Ver todo <ArrowRight className="size-3" />
          </Link>
        </div>
        {recent.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-3">Sin movimientos todavía.</p>
        )}
        {recent.map((tx, i) => (
          <TransactionRow key={tx.id} tx={tx} boxes={boxes} last={i === recent.length - 1} />
        ))}
      </section>
    </div>
  );
}
