import { useState } from 'react';
import { toast } from 'sonner';
import { TransactionType } from '@app/contracts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBoxBalances, useCreateTransaction } from '@/hooks/use-finance';
import { boxColor } from '@/lib/boxes';
import { cn } from '@/lib/utils';

const TYPES: Array<{ value: TransactionType; label: string }> = [
  { value: TransactionType.EXPENSE, label: 'Gasto' },
  { value: TransactionType.INCOME, label: 'Ingreso' },
  { value: TransactionType.TRANSIT, label: 'Tránsito' },
];

/** Registro manual del design: tabs de tipo, monto, selector de caja, nota. */
export function RegistroDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [amount, setAmount] = useState('');
  const [boxId, setBoxId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const { data: boxes = [] } = useBoxBalances();
  const create = useCreateTransaction();

  const parsed = parseFloat(amount.replace(',', '.'));
  const needsBox = type === TransactionType.EXPENSE;
  const valid = parsed > 0 && (!needsBox || Boolean(boxId));

  const submit = () => {
    if (!valid) return;
    create.mutate(
      {
        type,
        boxId: needsBox ? boxId : null,
        amount: Math.round(parsed * 100) / 100,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`✓ Registrado S/${parsed.toFixed(2)}`);
          setOpen(false);
          setAmount('');
          setNote('');
          setBoxId(null);
        },
        onError: (err) => toast.error(`No se pudo registrar: ${err.message}`),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
        </DialogHeader>

        <div className="flex rounded-xl bg-surface-alt p-1">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors',
                type === t.value ? 'bg-surface text-ink shadow-card' : 'text-ink-2',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="money text-xl text-ink-3">S/</span>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            inputMode="decimal"
            placeholder="0.00"
            className="money h-14 border-none bg-transparent !text-4xl font-semibold shadow-none focus-visible:ring-0"
            autoFocus
          />
        </div>

        {needsBox && (
          <div className="flex flex-wrap gap-1.5">
            {boxes
              .filter((b) => b.active)
              .map((b) => {
                const color = boxColor(b.name);
                const selected = boxId === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setBoxId(b.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                      selected
                        ? 'border-transparent text-white'
                        : 'border-line bg-surface text-ink-2 hover:bg-surface-alt',
                    )}
                    style={selected ? { backgroundColor: color } : undefined}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: selected ? '#fff' : color }}
                    />
                    {b.name}
                  </button>
                );
              })}
          </div>
        )}

        {type === TransactionType.INCOME && (
          <p className="text-xs text-ink-3">Se reparte automáticamente entre tus cajas según %.</p>
        )}

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          maxLength={300}
        />

        <Button size="lg" disabled={!valid || create.isPending} onClick={submit}>
          Registrar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
