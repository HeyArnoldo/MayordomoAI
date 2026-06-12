import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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

/** Borrado definitivo: exige escribir la palabra de confirmación — irreversible a propósito. */
export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation(['settings', 'common']);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState('');

  const confirmWord = t('account.deleteDialog.confirmWord');

  const remove = useMutation({
    mutationFn: usersApi.deleteAccount,
    onSuccess: () => {
      qc.clear();
      toast.success(t('account.deleteDialog.success'));
      navigate('/login', { replace: true });
    },
    onError: (err) => {
      const msg = isAxiosError(err)
        ? ((err.response?.data as { message?: string } | undefined)?.message ??
          t('account.deleteDialog.error'))
        : t('account.deleteDialog.error');
      toast.error(msg);
    },
  });

  const armed = confirm.trim().toUpperCase() === confirmWord;

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
          <AlertDialogTitle>{t('account.deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('account.deleteDialog.description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <p className="text-[12.5px] text-ink-2">
            <Trans
              t={t}
              i18nKey="account.deleteDialog.typeToConfirm"
              values={{ word: confirmWord }}
              components={{ word: <span className="font-mono font-bold text-negative" /> }}
            />
          </p>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={confirmWord}
            autoFocus
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!armed || remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending
              ? t('account.deleteDialog.deleting')
              : t('account.deleteDialog.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
