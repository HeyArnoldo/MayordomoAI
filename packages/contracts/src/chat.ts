import { z } from 'zod';

const imageMediaItemSchema = z.object({
  type: z.literal('image'),
  mediaType: z.string(),
  filename: z.string().nullable(),
  size: z.number().int().nullable(),
});

const documentMediaItemSchema = z.object({
  type: z.literal('document'),
  mediaType: z.string(),
  filename: z.string().nullable(),
  size: z.number().int().nullable(),
  /** PDF only — undefined for other formats. */
  pageCount: z.number().int().nullable().optional(),
});

export const mediaItemSchema = z.discriminatedUnion('type', [
  imageMediaItemSchema,
  documentMediaItemSchema,
]);
export type MediaItem = z.infer<typeof mediaItemSchema>;

export enum Channel {
  WHATSAPP = 'whatsapp',
  WEB = 'web',
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

export enum ClarificationStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  EXPIRED = 'expired',
}

export const conversationSchema = z.object({
  id: z.uuid(),
  channel: z.enum(Channel),
  title: z.string(),
  /** El hilo de WhatsApp es de sistema: fijado, no se borra ni renombra. */
  isSystem: z.boolean(),
  pinned: z.boolean(),
  open: z.boolean(),
  lastAt: z.string(),
  createdAt: z.string(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const messageSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  role: z.enum(MessageRole),
  content: z.string(),
  channel: z.enum(Channel),
  toolCalls: z.unknown().nullable(),
  createdAt: z.string(),
  mediaContext: z.array(mediaItemSchema).nullable().optional(),
});
export type Message = z.infer<typeof messageSchema>;

export const createConversationSchema = z.object({
  title: z.string().min(1).max(120).optional(),
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const renameConversationSchema = z.object({
  title: z.string().min(1).max(120),
});
export type RenameConversationInput = z.infer<typeof renameConversationSchema>;

/** Una llamada a herramienta del agente — el "reasoning trail" visible. */
export const toolAuditSchema = z.object({
  id: z.uuid(),
  tool: z.string(),
  args: z.unknown(),
  result: z.unknown().nullable(),
  conversationId: z.uuid().nullable(),
  createdAt: z.string(),
});
export type ToolAudit = z.infer<typeof toolAuditSchema>;
