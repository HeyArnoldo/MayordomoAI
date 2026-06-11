import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { BoxScope, BoxType } from '@app/contracts';
import { useCreateBox } from '@/hooks/use-finance';
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
  {
    value: BoxType.EXPENSE,
    label: 'Gasto',
    hint: 'El saldo del mes se usa y se renueva con cada ingreso',
  },
  {
    value: BoxType.FUND,
    label: 'Fondo',
    hint: 'Acumula histórico — para metas tipo Ahorro',
  },
] as const;

/** Alta de caja del flujo de Cajas: nace con 0% y se reparte en el editor. */
export function NewBoxDialog({ trigger }: { trigger: ReactNode }) {
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
              ? `Caja "${box.name}" creada`
              : `Caja "${box.name}" creada con 0% — ajusta el reparto y guarda`,
          );
          setOpen(false);
          setName('');
          setType(BoxType.EXPENSE);
          setBusiness(false);
        },
        onError: (err) => {
          const msg = isAxiosError(err)
            ? ((err.response?.data as { message?: string } | undefined)?.message ?? err.message)
            : 'No se pudo crear la caja';
          toast.error(msg);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva caja</DialogTitle>
          <DialogDescription>
            Nace con 0% del reparto — después le asignas su porcentaje en el editor.
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
            <Label htmlFor="box-name">Nombre</Label>
            <Input
              id="box-name"
              autoFocus
              value={name}
              maxLength={60}
              placeholder="Ej. Mascota, Gym, Regalos"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
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
                    {opt.label}
                  </div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-ink-2">{opt.hint}</div>
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
            Ámbito empresa (no participa del reparto por %)
          </label>

          <Button type="submit" className="w-full" disabled={!valid || create.isPending}>
            {create.isPending ? 'Creando…' : 'Crear caja'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
