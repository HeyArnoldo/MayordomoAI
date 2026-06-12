import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.uuid(),
});
export type IdParam = z.infer<typeof idParamSchema>;

/** Número en E.164: +51987654321 */
export const phoneSchema = z.object({
  e164: z.string().refine((v) => /^\+[1-9]\d{7,14}$/.test(v), {
    message: 'Formato E.164: +51987654321',
    params: { code: 'common.invalid_e164_format' },
  }),
});
export type PhoneInput = z.infer<typeof phoneSchema>;

/** Código de verificación que llega por WhatsApp. */
export const verifyCodeSchema = z.object({
  code: z.string().refine((v) => /^\d{6}$/.test(v), {
    message: 'Código de 6 dígitos',
    params: { code: 'common.invalid_verification_code' },
  }),
});
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;

/**
 * Cambio de nombre desde Configuración: es como el mayordomo llama al usuario.
 * Sin mensajes custom: min/max usan el locale global de Zod (z.config en la web).
 */
export const updateNameSchema = z.object({
  name: z.string().trim().min(2).max(120),
});
export type UpdateNameInput = z.infer<typeof updateNameSchema>;
