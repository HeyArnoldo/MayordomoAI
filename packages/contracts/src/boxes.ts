import { z } from 'zod';

export enum BoxType {
  EXPENSE = 'expense', // reinicia cada mes
  FUND = 'fund', // acumula (ahorro)
}

export enum BoxScope {
  PERSONAL = 'personal',
  BUSINESS = 'business',
}

export const createBoxSchema = z.object({
  name: z.string().min(1).max(60),
  // Puntos porcentuales (25 = 25%). El set personal activo debe sumar 100.
  pct: z.number().min(0).max(100).multipleOf(0.01),
  type: z.enum(BoxType),
  scope: z.enum(BoxScope).default(BoxScope.PERSONAL),
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateBoxInput = z.infer<typeof createBoxSchema>;

export const updateBoxSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  pct: z.number().min(0).max(100).multipleOf(0.01).optional(),
  type: z.enum(BoxType).optional(),
  scope: z.enum(BoxScope).optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});
export type UpdateBoxInput = z.infer<typeof updateBoxSchema>;

/** Actualización masiva del reparto: el backend valida que los % sumen 100. */
export const allocationSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        pct: z.number().min(0).max(100).multipleOf(0.01),
      }),
    )
    .min(1),
});
export type AllocationInput = z.infer<typeof allocationSchema>;

export const boxSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  pct: z.number(),
  type: z.enum(BoxType),
  scope: z.enum(BoxScope),
  sortOrder: z.number().int(),
  active: z.boolean(),
  createdAt: z.string(),
});
export type Box = z.infer<typeof boxSchema>;

/** Caja con su estado del periodo: asignado por %, gastado y saldo (SUM al leer). */
export const boxBalanceSchema = boxSchema.extend({
  allocated: z.number(),
  spent: z.number(),
  balance: z.number(),
  /** Solo cajas tipo fund: total acumulado histórico. */
  accumulated: z.number().nullable(),
});
export type BoxBalance = z.infer<typeof boxBalanceSchema>;
