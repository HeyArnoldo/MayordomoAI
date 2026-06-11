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

/** Uso de IA agregado por usuario (costos ESTIMADOS con precios locales). */
export const adminUsageRowSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable(),
  requests: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  costUsd: z.number(),
  // kind ('agent' | 'title' | 'transcription') → subtotal
  kinds: z.record(z.string(), z.object({ requests: z.number(), costUsd: z.number() })),
});
export type AdminUsageRow = z.infer<typeof adminUsageRowSchema>;

export interface AdminUsageReport {
  days: number;
  totalCostUsd: number;
  totalRequests: number;
  rows: AdminUsageRow[];
}
