import { z } from 'zod';

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  /** Dinero de paso (reembolsos que reenviás): no toca cajas ni %. */
  TRANSIT = 'transit',
}

export enum TransactionSource {
  WHATSAPP = 'whatsapp',
  PWA = 'pwa',
  IMPORT = 'import',
}

export enum TransactionStatus {
  CONFIRMED = 'confirmed',
  PENDING = 'pending',
  VOIDED = 'voided',
}

export const createTransactionSchema = z.object({
  type: z.enum(TransactionType),
  /** Requerida para gastos; null en ingresos (se reparten por %) y tránsito. */
  boxId: z.uuid().nullable().optional(),
  amount: z.number().positive().multipleOf(0.01).max(9_999_999_999.99),
  note: z.string().max(300).optional(),
  /** ISO 8601; si falta, ahora. La fecha contable se deriva en America/Lima. */
  occurredAt: z.iso.datetime({ offset: true }).optional(),
  voice: z.boolean().optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const listTransactionsSchema = z.object({
  type: z.enum(TransactionType).optional(),
  boxId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  includeVoided: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;

/** Snapshot del reparto de un ingreso entre cajas (inmutable ante cambios de %). */
export const splitItemSchema = z.object({
  boxId: z.uuid(),
  name: z.string(),
  pct: z.number(),
  amount: z.number(),
});
export type SplitItem = z.infer<typeof splitItemSchema>;

export const transactionSchema = z.object({
  id: z.uuid(),
  type: z.enum(TransactionType),
  boxId: z.uuid().nullable(),
  amount: z.number(),
  currency: z.string(),
  date: z.string(),
  occurredAt: z.string(),
  note: z.string().nullable(),
  source: z.enum(TransactionSource),
  status: z.enum(TransactionStatus),
  split: z.array(splitItemSchema).nullable(),
  voice: z.boolean(),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;
