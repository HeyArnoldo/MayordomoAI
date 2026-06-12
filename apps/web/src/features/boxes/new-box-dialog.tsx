import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BoxScope, BoxType } from '@app/contracts';
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

/** Alta de caja del flujo de Cajas: nace con 0% y se reparte en el editor. */
export function NewBoxDialog({ trigger }: { trigger: ReactNode }) {
  const { t } = useTranslation('boxes');
  const create = useCreateBox();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<BoxType>(BoxType.EXPENSE);
  const [business, setBusiness] = useState(false);

  const valid = name.trim().length > 0 && name.trim().length <= 60;

  const submit = () => {
    create.mutate(
      {
        name: name.trim(),
        // Nace con 0%: el reparto se ajusta en el editor (debe sumar 100).
        pct: 0,
        type,
        scope: business ? BoxScope.BUSINESS : BoxScope.PERSONAL,
      },
      {
        onSuccess: (box) => {
          toast.success(
            business
              ? t('new.createdBusiness', { name: box.name })
              : t('new.createdPersonal', { name: box.name }),
          );
          setOpen(false);
          setName('');
          setType(BoxType.EXPENSE);
          setBusiness(false);
        },
        onError: (err) => toast.error(translateApiError(err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('new.title')}</DialogTitle>
          <DialogDescription>{t('new.description')}</DialogDescription>
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

          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-2">
            <input
              type="checkbox"
              checked={business}
              onChange={(e) => setBusiness(e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            {t('new.businessScope')}
          </label>

          <Button type="submit" className="w-full" disabled={!valid || create.isPending}>
            {create.isPending ? t('new.creating') : t('new.create')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
