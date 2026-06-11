import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { Archive, Check } from 'lucide-react';
import { BOX_COLOR_KEYS, type BoxBalance, type BoxColorKey } from '@app/contracts';
import { useUpdateBox } from '@/hooks/use-finance';
import { boxColor } from '@/lib/boxes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function apiError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string } | undefined)?.message;
    if (msg) return msg;
  }
  return fallback;
}

/** Edición de caja: nombre, color (tokens del design) y archivado. */
export function EditBoxDialog({ box, onClose }: { box: BoxBalance | null; onClose: () => void }) {
  const update = useUpdateBox();
  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState<BoxColorKey | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Sincroniza el form cuando cambia la caja seleccionada.
  useEffect(() => {
    if (box) {
      setName(box.name);
      setColorKey(box.colorKey);
    }
  }, [box]);

  if (!box) return null;

  const valid = name.trim().length > 0 && name.trim().length <= 60;
  const dirty = name.trim() !== box.name || colorKey !== box.colorKey;

  const save = () => {
    update.mutate(
      { id: box.id, input: { name: name.trim(), colorKey } },
      {
        onSuccess: () => {
          toast.success('Caja actualizada');
          onClose();
        },
        onError: (err) => toast.error(apiError(err, 'No se pudo actualizar la caja')),
      },
    );
  };

  const archive = () => {
    update.mutate(
      // Archivar saca la caja del reparto: su % debe volver a repartirse.
      { id: box.id, input: { active: false, pct: 0 } },
      {
        onSuccess: () => {
          toast.success(`"${box.name}" archivada — redistribuye su ${box.pct}% y guarda`);
          setConfirmArchive(false);
          onClose();
        },
        onError: (err) => toast.error(apiError(err, 'No se pudo archivar')),
      },
    );
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar caja</DialogTitle>
            <DialogDescription>
              El nombre y color aplican en toda la app; el historial no cambia.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid && dirty) save();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-box-name">Nombre</Label>
              <Input
                id="edit-box-name"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {BOX_COLOR_KEYS.map((key) => {
                  const selected =
                    (colorKey ?? null) === key ||
                    (!colorKey && boxColor(box.name) === `var(--caja-${key})`);
                  return (
                    <button
                      key={key}
                      type="button"
                      title={key}
                      onClick={() => setColorKey(key)}
                      className={cn(
                        'flex size-9 items-center justify-center rounded-full border-2 transition',
                        selected ? 'border-ink' : 'border-transparent hover:scale-110',
                      )}
                      style={{ backgroundColor: `var(--caja-${key})` }}
                    >
                      {selected && <Check className="size-4 text-white drop-shadow" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11.5px] text-ink-3">
                Colores del sistema — se adaptan solos al modo oscuro.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!valid || !dirty || update.isPending}
            >
              {update.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </form>

          <button
            onClick={() => setConfirmArchive(true)}
            className="inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-ink-3 hover:text-negative"
          >
            <Archive className="size-3.5" /> Archivar esta caja
          </button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar "{box.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Sale del reparto y del dashboard, pero su historial de movimientos se conserva. Su{' '}
              {box.pct}% quedará libre — tendrás que redistribuirlo para que el reparto sume 100.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={archive}>Archivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
