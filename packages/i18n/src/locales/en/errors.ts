import type { errors as es } from '../es/errors';

export const errors = {
  auth: {
    invalid_credentials: 'Invalid credentials',
    invalid_session: 'Invalid session',
    email_already_registered: 'This email is already registered',
    forbidden: 'You do not have permission to perform this action',
  },
  account: {
    pending_activation: 'Your account is pending activation',
  },
  phone: {
    number_already_taken: 'That number already belongs to another account',
    not_registered: 'Register a number first',
    already_verified: 'The number is already verified',
    resend_too_soon: 'Wait {{seconds}} seconds before resending the code',
    no_active_code: 'No active code — request a new one',
    code_expired: 'The code expired — request a new one',
    code_incorrect: 'Incorrect code',
  },
  transaction: {
    expense_requires_box: 'An expense requires a box',
    box_inactive: 'The box is inactive',
    no_boxes_for_income: 'No boxes available to split the income',
    not_found: 'Transaction not found',
  },
  conversation: {
    not_found: 'Conversation not found',
    whatsapp_thread_rename_forbidden: 'The WhatsApp thread cannot be renamed',
    whatsapp_thread_delete_forbidden: 'The WhatsApp thread cannot be deleted',
  },
  admin: {
    cannot_change_own_status: 'You cannot change your own status',
    user_not_found: 'User not found',
    cannot_change_own_role: 'You cannot change your own role',
    last_admin: 'This is the last administrator — assign another before downgrading',
  },
  user: {
    last_admin_cannot_delete:
      'You are the last administrator — assign another before deleting your account',
  },
  chat: {
    audio_missing: 'Audio is missing',
    transcription_failed: 'Could not transcribe the audio',
    image_rejected:
      'The image could not be accepted. Check the file type, size, and number of images.',
    document_rejected:
      'The document could not be read. Check the file type, size, or that it contains selectable text.',
  },
  agent: {
    ai_credentials_missing: 'The agent is not available at this time',
  },
  common: {
    invalid_e164_format: 'Invalid phone number format (E.164: +51987654321)',
    invalid_verification_code: 'Enter the 6-digit code',
    unexpected: 'An unexpected error occurred',
  },
  preferences: {
    nothing_to_update: 'Nothing to update',
  },
  box: {
    not_found: 'Box not found',
    not_in_allocation: 'Box {{id}} does not exist or is not part of the split',
    allocation_must_sum_100: 'Percentages must add up to 100 (they add up to {{total}})',
  },
  recurring: {
    not_found: 'Recurring expense not found',
  },
  server: {
    internal_error: 'An unexpected error occurred',
  },
  agent_tools: {
    demo_user_missing: 'Service unavailable',
    demo_user_not_found: 'Service unavailable',
  },
  _fallback: 'An unexpected error occurred',
} satisfies typeof es;
