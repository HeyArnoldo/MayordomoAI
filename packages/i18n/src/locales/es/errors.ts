import type { ErrorCode } from '@app/contracts';

// Translations for all API error codes. Keys mirror the ErrorCode catalog exactly.
// This file is the source of truth — en/errors.ts uses `satisfies typeof errors`.
export const errors = {
  auth: {
    invalid_credentials: 'Credenciales inválidas',
    invalid_session: 'Sesión inválida',
    email_already_registered: 'Este correo ya está registrado',
    forbidden: 'No tienes permisos para esta acción',
  },
  account: {
    pending_activation: 'Tu cuenta está pendiente de activación',
  },
  phone: {
    number_already_taken: 'Ese número ya pertenece a otra cuenta',
    not_registered: 'Primero registra un número',
    already_verified: 'El número ya está verificado',
    resend_too_soon: 'Espera {{seconds}} segundos para reenviar el código',
    no_active_code: 'No hay un código vigente — solicita uno nuevo',
    code_expired: 'El código venció — solicita uno nuevo',
    code_incorrect: 'Código incorrecto',
  },
  transaction: {
    expense_requires_box: 'Un gasto necesita una caja',
    box_inactive: 'La caja está inactiva',
    no_boxes_for_income: 'No hay cajas para repartir el ingreso',
    not_found: 'Movimiento no encontrado',
  },
  conversation: {
    not_found: 'Conversación no encontrada',
    whatsapp_thread_rename_forbidden: 'El hilo de WhatsApp no se puede renombrar',
    whatsapp_thread_delete_forbidden: 'El hilo de WhatsApp no se puede eliminar',
  },
  admin: {
    cannot_change_own_status: 'No puedes cambiar tu propio estado',
    user_not_found: 'Usuario no encontrado',
    cannot_change_own_role: 'No puedes cambiar tu propio rol',
    last_admin: 'Es el último administrador — asigna otro antes de degradarlo',
  },
  user: {
    last_admin_cannot_delete:
      'Eres el último administrador — asigna otro antes de eliminar tu cuenta',
  },
  chat: {
    audio_missing: 'Falta el audio',
    transcription_failed: 'No se pudo transcribir el audio',
    image_rejected:
      'No se pudo aceptar la imagen. Revisa el tipo de archivo, el tamaño y la cantidad de imágenes.',
    document_rejected:
      'No se pudo leer el documento. Revisa el tipo de archivo, el tamaño o que contenga texto seleccionable.',
  },
  agent: {
    ai_credentials_missing: 'El agente no está disponible en este momento',
  },
  common: {
    invalid_e164_format: 'Formato de número inválido (E.164: +51987654321)',
    invalid_verification_code: 'Código de 6 dígitos',
    unexpected: 'Ocurrió un error inesperado',
  },
  preferences: {
    nothing_to_update: 'Nada que actualizar',
  },
  box: {
    not_found: 'Caja no encontrada',
    not_in_allocation: 'La caja {{id}} no existe o no participa del reparto',
    allocation_must_sum_100: 'Los porcentajes deben sumar 100 (suman {{total}})',
  },
  recurring: {
    not_found: 'Gasto fijo no encontrado',
  },
  server: {
    internal_error: 'Ocurrió un error inesperado',
  },
  agent_tools: {
    demo_user_missing: 'Servicio no disponible',
    demo_user_not_found: 'Servicio no disponible',
  },
  /** Fallback for unknown codes — should not appear in normal usage. */
  _fallback: 'Ocurrió un error inesperado',
};

// Compile-time assertion: every ErrorCode maps to a key reachable via dot notation.
// If a code is added to the catalog but omitted here, tsc will error on the line below.
type DotKeys<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? DotKeys<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

// ErrorCode must be a subset of the dot-key union derived from `errors`.
// `satisfies` forces evaluation: if any ErrorCode is missing a key here, the
// conditional resolves to `never` and `true satisfies never` fails to compile.
true satisfies ErrorCode extends DotKeys<typeof errors> ? true : never;
