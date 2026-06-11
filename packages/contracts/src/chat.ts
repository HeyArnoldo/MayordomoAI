import { z } from 'zod';

export enum Canal {
  WHATSAPP = 'whatsapp',
  WEB = 'web',
}

export enum MensajeRol {
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

export enum PendienteEstado {
  ABIERTO = 'abierto',
  RESUELTO = 'resuelto',
  EXPIRADO = 'expirado',
}

export const conversacionSchema = z.object({
  id: z.uuid(),
  canal: z.enum(Canal),
  titulo: z.string(),
  /** El hilo de WhatsApp es de sistema: fijado, no se borra ni renombra. */
  sistema: z.boolean(),
  fijada: z.boolean(),
  abierta: z.boolean(),
  lastAt: z.string(),
  createdAt: z.string(),
});
export type Conversacion = z.infer<typeof conversacionSchema>;

export const mensajeSchema = z.object({
  id: z.uuid(),
  conversacionId: z.uuid(),
  rol: z.enum(MensajeRol),
  contenido: z.string(),
  canal: z.enum(Canal),
  toolCalls: z.unknown().nullable(),
  createdAt: z.string(),
});
export type Mensaje = z.infer<typeof mensajeSchema>;

export const createConversacionSchema = z.object({
  titulo: z.string().min(1).max(120).optional(),
});
export type CreateConversacionInput = z.infer<typeof createConversacionSchema>;

export const renameConversacionSchema = z.object({
  titulo: z.string().min(1).max(120),
});
export type RenameConversacionInput = z.infer<typeof renameConversacionSchema>;

/** Una llamada a herramienta del agente — el "reasoning trail" visible. */
export const auditToolSchema = z.object({
  id: z.uuid(),
  tool: z.string(),
  args: z.unknown(),
  resultado: z.unknown().nullable(),
  conversacionId: z.uuid().nullable(),
  createdAt: z.string(),
});
export type AuditTool = z.infer<typeof auditToolSchema>;
