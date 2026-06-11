import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { Check, Clock3, ShieldCheck, UserX } from 'lucide-react';
import { UserRole, UserStatus, type AdminUser } from '@app/contracts';
import { useMe } from '@/hooks/use-auth';
import { adminApi } from '@/services/admin.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const USERS_KEY = ['admin', 'users'] as const;

const STATUS_META: Record<UserStatus, { label: string; className: string }> = {
  [UserStatus.PENDING]: { label: 'Pendiente', className: 'bg-warn/15 text-warn' },
  [UserStatus.ACTIVE]: { label: 'Activa', className: 'bg-brand-soft text-brand' },
  [UserStatus.SUSPENDED]: { label: 'Suspendida', className: 'bg-negative-soft text-negative' },
};

function apiError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string } | undefined)?.message;
    if (msg) return msg;
  }
  return fallback;
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

/** Panel de administración: cola de aprobación + gestión de status y roles. */
export default function AdminPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: USERS_KEY,
    queryFn: () => adminApi.users(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: USERS_KEY });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      adminApi.updateStatus(id, status),
    onSuccess: (u) => {
      invalidate();
      toast.success(`${u.name}: cuenta ${STATUS_META[u.status].label.toLowerCase()}`);
    },
    onError: (err) => toast.error(apiError(err, 'No se pudo cambiar el status')),
  });

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => adminApi.updateRole(id, role),
    onSuccess: (u) => {
      invalidate();
      toast.success(`${u.name} ahora es ${u.role === UserRole.ADMIN ? 'admin' : 'usuario'}`);
    },
    onError: (err) => toast.error(apiError(err, 'No se pudo cambiar el rol')),
  });

  const pending = (users ?? []).filter((u) => u.status === UserStatus.PENDING);

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
      <Tabs defaultValue={pending.length > 0 ? 'pendientes' : 'todos'}>
        <TabsList>
          <TabsTrigger value="pendientes" className="gap-1.5">
            <Clock3 className="size-3.5" />
            Pendientes
            {pending.length > 0 && (
              <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-on-brand">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="todos">Todos los usuarios</TabsTrigger>
        </TabsList>

        {/* ── Cola de aprobación ── */}
        <TabsContent value="pendientes" className="mt-4">
          {pending.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-line bg-surface py-14 text-center">
              <div className="flex size-11 items-center justify-center rounded-[13px] bg-brand-soft text-brand">
                <Check className="size-5" />
              </div>
              <p className="mt-3 text-[14.5px] font-semibold text-ink">
                Sin solicitudes pendientes
              </p>
              <p className="mt-1 text-[13px] text-ink-2">
                Cuando alguien entre con Google aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pending.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center"
                >
                  <UserCell user={u} />
                  <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
                    <span className="text-[12px] text-ink-3">desde el {fecha(u.createdAt)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-negative hover:text-negative"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: u.id, status: UserStatus.SUSPENDED })}
                    >
                      <UserX className="size-4" />
                      Rechazar
                    </Button>
                    <Button
                      size="sm"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: u.id, status: UserStatus.ACTIVE })}
                    >
                      <Check className="size-4" />
                      Aprobar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Todos los usuarios ── */}
        <TabsContent value="todos" className="mt-4">
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <UserCell user={u} compact />
                      </TableCell>
                      <TableCell>
                        {u.phoneE164 ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[13px] text-ink">
                            {u.phoneE164}
                            {u.phoneVerified && <ShieldCheck className="size-3.5 text-brand" />}
                          </span>
                        ) : (
                          <span className="text-[13px] text-ink-3">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {self ? (
                          <Badge className={STATUS_META[u.status].className}>
                            {STATUS_META[u.status].label}
                          </Badge>
                        ) : (
                          <Select
                            value={u.status}
                            onValueChange={(v) =>
                              setStatus.mutate({ id: u.id, status: v as UserStatus })
                            }
                          >
                            <SelectTrigger size="sm" className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(UserStatus).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {STATUS_META[s].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {self ? (
                          <Badge className="bg-brand-soft text-brand">Admin (tú)</Badge>
                        ) : (
                          <Select
                            value={u.role}
                            onValueChange={(v) => setRole.mutate({ id: u.id, role: v as UserRole })}
                          >
                            <SelectTrigger size="sm" className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UserRole.USER}>Usuario</SelectItem>
                              <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-[12.5px] text-ink-3">
                        {fecha(u.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-[12px] text-ink-3">
            No puedes cambiar tu propio rol ni status, y el último admin no puede ser degradado —
            asigna otro admin primero.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserCell({ user, compact = false }: { user: AdminUser; compact?: boolean }) {
  const initial = user.name.charAt(0).toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-3">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className={`shrink-0 rounded-full border border-line ${compact ? 'size-8' : 'size-10'}`}
        />
      ) : (
        <span
          className={`flex shrink-0 items-center justify-center rounded-full border border-line bg-brand-soft font-bold text-brand ${
            compact ? 'size-8 text-sm' : 'size-10'
          }`}
        >
          {initial}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-ink">{user.name}</div>
        <div className="truncate text-[12.5px] text-ink-2">{user.email}</div>
      </div>
    </div>
  );
}
