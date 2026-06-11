import { z } from 'zod';

export enum CajaTipo {
  GASTO = 'gasto',
  FONDO = 'fondo',
}

export enum CajaAmbito {
  PERSONAL = 'personal',
  EMPRESA = 'empresa',
}

export const createCajaSchema = z.object({
  nombre: z.string().min(1).max(60),
  // Puntos porcentuales (25 = 25%). El conjunto activo debe sumar 100.
  pct: z.number().min(0).max(100).multipleOf(0.01),
  tipo: z.enum(CajaTipo),
  ambito: z.enum(CajaAmbito).default(CajaAmbito.PERSONAL),
  orden: z.number().int().min(0).optional(),
});
export type CreateCajaInput = z.infer<typeof createCajaSchema>;

export const updateCajaSchema = z.object({
  nombre: z.string().min(1).max(60).optional(),
  pct: z.number().min(0).max(100).multipleOf(0.01).optional(),
  tipo: z.enum(CajaTipo).optional(),
  ambito: z.enum(CajaAmbito).optional(),
  orden: z.number().int().min(0).optional(),
  activa: z.boolean().optional(),
});
export type UpdateCajaInput = z.infer<typeof updateCajaSchema>;

/** Actualización masiva del reparto: el backend valida que los % sumen 100. */
export const repartoSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        pct: z.number().min(0).max(100).multipleOf(0.01),
      }),
    )
    .min(1),
});
export type RepartoInput = z.infer<typeof repartoSchema>;

export const cajaSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  pct: z.number(),
  tipo: z.enum(CajaTipo),
  ambito: z.enum(CajaAmbito),
  orden: z.number().int(),
  activa: z.boolean(),
  createdAt: z.string(),
});
export type Caja = z.infer<typeof cajaSchema>;

/** Caja con su estado del periodo: asignado por %, gastado y saldo (SUM al leer). */
export const cajaSaldoSchema = cajaSchema.extend({
  asignado: z.number(),
  gastado: z.number(),
  saldo: z.number(),
  /** Solo cajas tipo fondo: total acumulado histórico. */
  acumulado: z.number().nullable(),
});
export type CajaSaldo = z.infer<typeof cajaSaldoSchema>;
