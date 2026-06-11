import { api } from '@/lib/api';
import type { AdminUser, UserRole, UserStatus } from '@app/contracts';

export const adminApi = {
  users: async (status?: UserStatus): Promise<AdminUser[]> =>
    (await api.get<AdminUser[]>('/admin/users', { params: status ? { status } : {} })).data,
  updateStatus: async (id: string, status: UserStatus): Promise<AdminUser> =>
    (await api.patch<AdminUser>(`/admin/users/${id}/status`, { status })).data,
  updateRole: async (id: string, role: UserRole): Promise<AdminUser> =>
    (await api.patch<AdminUser>(`/admin/users/${id}/role`, { role })).data,
};
