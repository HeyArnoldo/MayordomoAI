import { z } from 'zod';

export enum BoxType {
  EXPENSE = 'expense', // reinicia cada mes
  FUND = 'fund', // acumula (ahorro)
}

export enum BoxScope {
  PERSONAL = 'personal',
  BUSINESS = 'business',
}

/**
 * Allocation mode for a box.
 *   percent — box receives pct × income_remainder (default, backward-compatible)
 *   fixed   — box is funded off-the-top with a specific fixedAmount each month
 *
 * Fixed mode applies ONLY to personal-scope boxes. Business boxes must stay percent.
 */
export enum BoxMode {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

/**
 * Colores de caja como TOKENS del design (no hex): la UI los resuelve a
 * var(--caja-<key>), que se adapta solo al modo claro/oscuro.
 */
export const BOX_COLOR_KEYS = [
  'ahorro',
  'varios',
  'pasajes',
  'ocio',
  'diezmo',
  'snacks',
  'ofrenda',
  'empresa',
] as const;
export const boxColorKeySchema = z.enum(BOX_COLOR_KEYS);
export type BoxColorKey = z.infer<typeof boxColorKeySchema>;

export const createBoxSchema = z
  .object({
    name: z.string().min(1).max(60),
    // Puntos porcentuales (25 = 25%). El set personal activo debe sumar 100.
    pct: z.number().min(0).max(100).multipleOf(0.01).optional().default(0),
    type: z.enum(BoxType),
    scope: z.enum(BoxScope).default(BoxScope.PERSONAL),
    colorKey: boxColorKeySchema.nullish(),
    sortOrder: z.number().int().min(0).optional(),
    /**
     * Allocation mode. Defaults to 'percent' for backward-compatibility.
     * When omitted, existing behavior (percent-based split) is preserved.
     */
    mode: z.enum(BoxMode).default(BoxMode.PERCENT),
    /**
     * Required when mode='fixed'. Must be > 0. Ignored (null) for percent boxes.
     */
    fixedAmount: z.number().positive().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.mode === BoxMode.FIXED) {
        return data.fixedAmount != null && data.fixedAmount > 0;
      }
      return true;
    },
    {
      message: 'fixedAmount is required and must be > 0 when mode is fixed',
      path: ['fixedAmount'],
    },
  )
  .refine(
    (data) => {
      if (data.mode === BoxMode.FIXED && data.scope === BoxScope.BUSINESS) {
        return false;
      }
      return true;
    },
    { message: 'Fixed mode is not supported for business-scope boxes', path: ['mode'] },
  );
export type CreateBoxInput = z.infer<typeof createBoxSchema>;

export const updateBoxSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    pct: z.number().min(0).max(100).multipleOf(0.01).optional(),
    type: z.enum(BoxType).optional(),
    scope: z.enum(BoxScope).optional(),
    colorKey: boxColorKeySchema.nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
    /** Change the allocation mode. Re-checks invariants for the new mode on save. */
    mode: z.enum(BoxMode).optional(),
    /** Required when switching to or updating in fixed mode. Must be > 0. */
    fixedAmount: z.number().positive().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.mode === BoxMode.FIXED) {
        return data.fixedAmount != null && data.fixedAmount > 0;
      }
      return true;
    },
    {
      message: 'fixedAmount is required and must be > 0 when mode is fixed',
      path: ['fixedAmount'],
    },
  );
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
  // null = el color se deduce del nombre (set conocido) o cae al gris de Varios.
  colorKey: boxColorKeySchema.nullable(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  createdAt: z.string(),
  /** Allocation mode. 'percent' is the default for existing boxes. */
  mode: z.enum(BoxMode).default(BoxMode.PERCENT),
  /** Fixed monthly amount in the user's currency. Null for percent-mode boxes. */
  fixedAmount: z.number().nullable().optional(),
});
export type Box = z.infer<typeof boxSchema>;

/** Caja con su estado del periodo: asignado por %, gastado y saldo (SUM al leer). */
export const boxBalanceSchema = boxSchema.extend({
  allocated: z.number(),
  spent: z.number(),
  balance: z.number(),
  /** Solo cajas tipo fund: total acumulado histórico. */
  accumulated: z.number().nullable(),
  /**
   * Fixed-mode only: how much remains to be funded this month.
   * max(fixedAmount − amountFunded, 0). Null for percent-mode boxes.
   */
  remainingToFill: z.number().nullable(),
});
export type BoxBalance = z.infer<typeof boxBalanceSchema>;
