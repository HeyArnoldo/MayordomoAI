/** Catalog of all stable, namespaced error codes used by the API.
 *
 * Rules:
 *  - Codes are dot-namespaced: `<namespace>.<key>` (lowercase snake_case).
 *  - Never rename a code — it is a public contract.
 *  - Add new codes here AND in packages/i18n error namespace before using them.
 */
export const ERROR_CODES = [
  'auth.invalid_credentials',
  'auth.invalid_session',
  'auth.email_already_registered',
  'auth.forbidden',
  'account.pending_activation',
  'phone.number_already_taken',
  'phone.not_registered',
  'phone.already_verified',
  'phone.resend_too_soon',
  'phone.no_active_code',
  'phone.code_expired',
  'phone.code_incorrect',
  'transaction.expense_requires_box',
  'transaction.box_inactive',
  'transaction.no_boxes_for_income',
  'transaction.not_found',
  'conversation.not_found',
  'conversation.whatsapp_thread_rename_forbidden',
  'conversation.whatsapp_thread_delete_forbidden',
  'admin.cannot_change_own_status',
  'admin.user_not_found',
  'admin.cannot_change_own_role',
  'admin.last_admin',
  'user.last_admin_cannot_delete',
  'chat.audio_missing',
  'chat.transcription_failed',
  'agent.ai_credentials_missing',
  'common.invalid_e164_format',
  'common.invalid_verification_code',
  'preferences.nothing_to_update',
  'box.not_found',
  'box.not_in_allocation',
  'box.allocation_must_sum_100',
  'recurring.not_found',
  'server.internal_error',
] as const;

/** Stable union of all valid error codes. Never rename a member. */
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Shape of error responses originating from an `AppException`.
 *
 * Note: this does NOT cover all API error shapes. 400 validation errors raised
 * by ZodValidationPipe have a different shape — `{ statusCode, message: string[], error }`
 * with no `code`. Unifying both shapes is deferred to a later slice. */
export interface ApiError {
  statusCode: number;
  code: ErrorCode;
  message: string;
  params?: Record<string, string | number>;
}
