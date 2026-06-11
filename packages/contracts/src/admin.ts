import { z } from 'zod';
import { UserRole, UserStatus } from './auth';

/** Fila del listado de usuarios en el panel admin. */
export const adminUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  role: z.enum(UserRole),
  status: z.enum(UserStatus),
  phoneE164: z.string().nullable(),
  phoneVerified: z.boolean(),
  createdAt: z.string(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum(UserStatus),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(UserRole),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
