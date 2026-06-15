import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Archive, Check } from 'lucide-react';
import { BOX_COLOR_KEYS, BoxMode, type BoxBalance, type BoxColorKey } from '@app/contracts';
import { translateApiError } from '@/lib/api-error';
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

/** Edición de caja: nombre, color (tokens del design), modo/monto fijo y archivado. */
export function EditBoxDialog({ box, onClose }: { box: BoxBalance | null; onClose: () => void }) {
  const { t } = useTranslation(['boxes', 'common']);
  const update = useUpdateBox();
  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState<BoxColorKey | null>(null);
  const [mode, setMode] = useState<BoxMode>(BoxMode.PERCENT);
  const [fixedAmount, setFixedAmount] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Sincroniza el form cuando cambia la caja seleccionada.
  useEffect(() => {
    if (box) {
      setName(box.name);
      setColorKey(box.colorKey);
      setMode(box.mode ?? BoxMode.PERCENT);
      setFixedAmount(box.fixedAmount != null ? String(box.fixedAmount) : '');
    }
  }, [box]);

  if (!box) return null;

  const currentMode = box.mode ?? BoxMode.PERCENT;
  const fixedAmountNum = parseFloat(fixedAmount) || 0;
  const validFixedAmount = mode === BoxMode.FIXED ? fixedAmountNum > 0 : true;
  const valid = name.trim().length > 0 && name.trim().length <= 60 && validFixedAmount;

  const modeDirty = mode !== currentMode;
  const fixedAmountDirty = mode === BoxMode.FIXED && fixedAmountNum !== (box.fixedAmount ?? 0);
  const dirty =
    name.trim() !== box.name || colorKey !== box.colorKey || modeDirty || fixedAmountDirty;

  const save = () => {
    const input =
      mode === BoxMode.FIXED
        ? { name: name.trim(), colorKey, mode: BoxMode.FIXED, fixedAmount: fixedAmountNum }
        : { name: name.trim(), colorKey, mode: BoxMode.PERCENT };

    update.mutate(
      { id: box.id, input },
      {
        onSuccess: () => {
          toast.success(t('edit.updated'));
          onClose();
        },
        onError: (err) => toast.error(translateApiError(err)),
      },
    );
  };

  const archive = () => {
    update.mutate(
      // Archivar saca la caja del reparto: su % debe volver a repartirse.
      { id: box.id, input: { active: false, pct: 0 } },
      {
        onSuccess: () => {
          toast.success(t('edit.archived', { name: box.name, pct: box.pct }));
          setConfirmArchive(false);
          onClose();
        },
        onError: (err) => toast.error(translateApiError(err)),
      },
    );
  };

  // Mode toggle is only shown for personal-scope boxes (business stays percent).
  const showModeToggle = box.scope === 'personal';

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('edit.title')}</DialogTitle>
            <DialogDescription>{t('edit.description')}</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid && dirty) save();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-box-name">{t('edit.nameLabel')}</Label>
              <Input
                id="edit-box-name"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('edit.colorLabel')}</Label>
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
              <p className="text-[11.5px] text-ink-3">{t('edit.colorsNote')}</p>
            </div>

            {/* Mode toggle — personal boxes only */}
            {showModeToggle && (
              <div className="space-y-1.5">
                <Label>{t('edit.modeLabel')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([BoxMode.PERCENT, BoxMode.FIXED] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMode(m);
                        if (m === BoxMode.PERCENT) setFixedAmount('');
                      }}
                      className={cn(
                        'rounded-xl border p-2.5 text-left transition-colors',
                        mode === m
                          ? 'border-brand bg-brand-soft'
                          : 'border-line bg-surface hover:bg-surface-alt',
                      )}
                    >
                      <span
                        className={cn(
                          'text-[13px] font-bold',
                          mode === m ? 'text-brand' : 'text-ink',
                        )}
                      >
                        {m === BoxMode.PERCENT ? t('edit.modePercent') : t('edit.modeFixed')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fixed amount input */}
            {mode === BoxMode.FIXED && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-fixed-amount">{t('edit.fixedAmountLabel')}</Label>
                <Input
                  id="edit-fixed-amount"
                  inputMode="decimal"
                  value={fixedAmount}
                  placeholder={t('edit.fixedAmountPlaceholder')}
                  onChange={(e) => {
                    const raw = e.target.value.replace(',', '.');
                    if (/^\d{0,10}(\.\d{0,2})?$/.test(raw)) setFixedAmount(raw);
                  }}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!valid || !dirty || update.isPending}
            >
              {update.isPending ? t('edit.saving') : t('edit.save')}
            </Button>
          </form>

          <button
            onClick={() => setConfirmArchive(true)}
            className="inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-ink-3 hover:text-negative"
          >
            <Archive className="size-3.5" /> {t('edit.archiveAction')}
          </button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('edit.confirmTitle', { name: box.name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('edit.confirmDescription', { pct: box.pct })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={archive}>{t('edit.confirmArchive')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
