import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.uuid(),
});
export type IdParam = z.infer<typeof idParamSchema>;

/** Número en E.164: +51987654321 */
export const phoneSchema = z.object({
  e164: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Formato E.164: +51987654321'),
});
export type PhoneInput = z.infer<typeof phoneSchema>;

/** Código de verificación que llega por WhatsApp. */
export const verifyCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Código de 6 dígitos'),
});
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
