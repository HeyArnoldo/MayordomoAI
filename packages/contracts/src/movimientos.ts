import { z } from 'zod';

export enum MovTipo {
  INGRESO = 'ingreso',
  GASTO = 'gasto',
  TRANSITO = 'transito',
}

export enum MovOrigen {
  WHATSAPP = 'whatsapp',
  PWA = 'pwa',
  IMPORT = 'import',
}

export enum MovEstado {
  CONFIRMADO = 'confirmado',
  PENDIENTE = 'pendiente',
  ANULADO = 'anulado',
}

export const createMovimientoSchema = z.object({
  tipo: z.enum(MovTipo),
  /** Requerida para gastos; null en ingresos (se reparten por %) y tránsito. */
  cajaId: z.uuid().nullable().optional(),
  monto: z.number().positive().multipleOf(0.01).max(9_999_999_999.99),
  nota: z.string().max(300).optional(),
  /** ISO 8601; si falta, ahora. La fecha contable se deriva en America/Lima. */
  ocurridoAt: z.iso.datetime({ offset: true }).optional(),
  voz: z.boolean().optional(),
});
export type CreateMovimientoInput = z.infer<typeof createMovimientoSchema>;

export const listMovimientosSchema = z.object({
  tipo: z.enum(MovTipo).optional(),
  cajaId: z.uuid().optional(),
  desde: z.iso.date().optional(),
  hasta: z.iso.date().optional(),
  incluirAnulados: z.coerce.boolean().default(false),
  limite: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListMovimientosInput = z.infer<typeof listMovimientosSchema>;

/** Snapshot del reparto de un ingreso entre cajas (inmutable ante cambios de %). */
export const splitItemSchema = z.object({
  cajaId: z.uuid(),
  nombre: z.string(),
  pct: z.number(),
  monto: z.number(),
});
export type SplitItem = z.infer<typeof splitItemSchema>;

export const movimientoSchema = z.object({
  id: z.uuid(),
  tipo: z.enum(MovTipo),
  cajaId: z.uuid().nullable(),
  monto: z.number(),
  moneda: z.string(),
  fecha: z.string(),
  ocurridoAt: z.string(),
  nota: z.string().nullable(),
  origen: z.enum(MovOrigen),
  estado: z.enum(MovEstado),
  split: z.array(splitItemSchema).nullable(),
  voz: z.boolean(),
  createdAt: z.string(),
});
export type Movimiento = z.infer<typeof movimientoSchema>;
