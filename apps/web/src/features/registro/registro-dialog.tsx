import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { resolveCurrency, TransactionType } from '@app/contracts';
import { formatMoney } from '@app/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMe } from '@/hooks/use-auth';
import { useLocale } from '@/hooks/use-locale';
import { useBoxBalances, useCreateTransaction } from '@/hooks/use-finance';
import { boxColor } from '@/lib/boxes';
import { cn } from '@/lib/utils';

const TYPES = [
  { value: TransactionType.EXPENSE, labelKey: 'registro.typeExpense' },
  { value: TransactionType.INCOME, labelKey: 'registro.typeIncome' },
] as const satisfies ReadonlyArray<{ value: TransactionType; labelKey: string }>;

/** Registro manual del design: tabs de tipo, monto, selector de caja, nota. */
export function RegistroDialog({ trigger }: { trigger: React.ReactNode }) {
  const { t } = useTranslation('transactions');
  const locale = useLocale();
  const { data: me } = useMe();
  const currency = resolveCurrency(me?.currency);
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
          toast.success(t('registro.success', { amount: formatMoney(parsed, currency, locale) }));
          setOpen(false);
          setAmount('');
          setNote('');
          setBoxId(null);
        },
        onError: (err) => toast.error(t('registro.error', { message: err.message })),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('registro.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex rounded-xl bg-surface-alt p-1">
          {TYPES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors',
                type === opt.value ? 'bg-surface text-ink shadow-card' : 'text-ink-2',
              )}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="money text-xl text-ink-3">{currency}</span>
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
                const color = boxColor(b.name, b.colorKey);
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
          <p className="text-xs text-ink-3">{t('registro.incomeHint')}</p>
        )}

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('registro.notePlaceholder')}
          maxLength={300}
        />

        <Button size="lg" disabled={!valid || create.isPending} onClick={submit}>
          {t('registro.submit')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
