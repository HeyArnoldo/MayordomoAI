import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { usersApi } from '@/services/users.api';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

const CONFIRM_WORD = 'ELIMINAR';

/** Borrado definitivo: exige escribir ELIMINAR — irreversible a propósito. */
export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState('');

  const remove = useMutation({
    mutationFn: usersApi.deleteAccount,
    onSuccess: () => {
      qc.clear();
      toast.success('Cuenta eliminada. Tu número quedó liberado.');
      navigate('/login', { replace: true });
    },
    onError: (err) => {
      const msg = isAxiosError(err)
        ? ((err.response?.data as { message?: string } | undefined)?.message ??
          'No se pudo eliminar la cuenta')
        : 'No se pudo eliminar la cuenta';
      toast.error(msg);
    },
  });

  const armed = confirm.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConfirm('');
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar tu cuenta definitivamente?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borran tus cajas, movimientos, conversaciones y gastos fijos. Tu número de WhatsApp
            queda liberado para otra cuenta. Esto NO se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <p className="text-[12.5px] text-ink-2">
            Escribe <span className="font-mono font-bold text-negative">{CONFIRM_WORD}</span> para
            confirmar:
          </p>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoFocus
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!armed || remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? 'Eliminando…' : 'Eliminar mi cuenta'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
