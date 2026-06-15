import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BoxMode, BoxScope, BoxType } from '@app/contracts';
import { useCreateBox } from '@/hooks/use-finance';
import { translateApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS = [
  { value: BoxType.EXPENSE, labelKey: 'new.typeExpense', hintKey: 'new.typeExpenseHint' },
  { value: BoxType.FUND, labelKey: 'new.typeFund', hintKey: 'new.typeFundHint' },
] as const;

const MODE_OPTIONS = [
  { value: BoxMode.PERCENT, labelKey: 'new.modePercent', hintKey: 'new.modePercentHint' },
  { value: BoxMode.FIXED, labelKey: 'new.modeFixed', hintKey: 'new.modeFixedHint' },
] as const;

/** Alta de caja del flujo de Cajas. Percent: nace con 0% y se reparte en el editor. Fixed: monto fijo mensual. */
export function NewBoxDialog({ trigger }: { trigger: ReactNode }) {
  const { t } = useTranslation('boxes');
  const create = useCreateBox();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<BoxType>(BoxType.EXPENSE);
  const [mode, setMode] = useState<BoxMode>(BoxMode.PERCENT);
  const [fixedAmount, setFixedAmount] = useState('');
  const [business, setBusiness] = useState(false);

  const fixedAmountNum = parseFloat(fixedAmount) || 0;
  const validFixedAmount = mode === BoxMode.FIXED ? fixedAmountNum > 0 : true;
  const valid = name.trim().length > 0 && name.trim().length <= 60 && validFixedAmount;

  // Fixed mode is personal-only (business scope does not support it).
  const effectiveBusiness = business && mode !== BoxMode.FIXED;

  const reset = () => {
    setName('');
    setType(BoxType.EXPENSE);
    setMode(BoxMode.PERCENT);
    setFixedAmount('');
    setBusiness(false);
  };

  const submit = () => {
    const scope = effectiveBusiness ? BoxScope.BUSINESS : BoxScope.PERSONAL;

    const input =
      mode === BoxMode.FIXED
        ? {
            name: name.trim(),
            pct: 0,
            type,
            scope,
            mode: BoxMode.FIXED,
            fixedAmount: fixedAmountNum,
          }
        : { name: name.trim(), pct: 0, type, scope, mode: BoxMode.PERCENT };

    create.mutate(input, {
      onSuccess: (box) => {
        if (mode === BoxMode.FIXED) {
          toast.success(t('new.createdFixed', { name: box.name, amount: fixedAmountNum }));
        } else if (effectiveBusiness) {
          toast.success(t('new.createdBusiness', { name: box.name }));
        } else {
          toast.success(t('new.createdPersonal', { name: box.name }));
        }
        setOpen(false);
        reset();
      },
      onError: (err) => toast.error(translateApiError(err)),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('new.title')}</DialogTitle>
          <DialogDescription>
            {mode === BoxMode.FIXED ? t('new.descriptionFixed') : t('new.description')}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) submit();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="box-name">{t('new.nameLabel')}</Label>
            <Input
              id="box-name"
              autoFocus
              value={name}
              maxLength={60}
              placeholder={t('new.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('new.typeLabel')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-colors',
                    type === opt.value
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface hover:bg-surface-alt',
                  )}
                >
                  <div
                    className={cn(
                      'text-[13.5px] font-bold',
                      type === opt.value ? 'text-brand' : 'text-ink',
                    )}
                  >
                    {t(opt.labelKey)}
                  </div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-ink-2">
                    {t(opt.hintKey)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mode toggle — only for personal scope */}
          {!business && (
            <div className="space-y-1.5">
              <Label>{t('new.modeLabel')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setMode(opt.value);
                      if (opt.value === BoxMode.PERCENT) setFixedAmount('');
                    }}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors',
                      mode === opt.value
                        ? 'border-brand bg-brand-soft'
                        : 'border-line bg-surface hover:bg-surface-alt',
                    )}
                  >
                    <div
                      className={cn(
                        'text-[13.5px] font-bold',
                        mode === opt.value ? 'text-brand' : 'text-ink',
                      )}
                    >
                      {t(opt.labelKey)}
                    </div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-ink-2">
                      {t(opt.hintKey)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fixed amount input — shown only when mode=fixed */}
          {mode === BoxMode.FIXED && (
            <div className="space-y-1.5">
              <Label htmlFor="box-fixed-amount">{t('new.fixedAmountLabel')}</Label>
              <Input
                id="box-fixed-amount"
                inputMode="decimal"
                value={fixedAmount}
                placeholder={t('new.fixedAmountPlaceholder')}
                onChange={(e) => {
                  const raw = e.target.value.replace(',', '.');
                  if (/^\d{0,10}(\.\d{0,2})?$/.test(raw)) setFixedAmount(raw);
                }}
              />
            </div>
          )}

          {/* Business scope — only available for percent mode */}
          {mode === BoxMode.PERCENT && (
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-2">
              <input
                type="checkbox"
                checked={business}
                onChange={(e) => setBusiness(e.target.checked)}
                className="size-4 accent-[var(--brand)]"
              />
              {t('new.businessScope')}
            </label>
          )}

          <Button type="submit" className="w-full" disabled={!valid || create.isPending}>
            {create.isPending ? t('new.creating') : t('new.create')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
