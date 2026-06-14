/** Shared guardrails for image attachments (both web and WhatsApp channels). */

export const MAX_IMAGES = 2;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
export const IMAGE_MIME_ALLOWLIST = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/** Shared guardrails for document attachments (both web and WhatsApp channels). */

export const MAX_DOCUMENTS = 1;
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_PDF_PAGES = 30;
export const MAX_EXTRACTED_CHARS = 40_000;
export const MIN_EXTRACTED_CHARS = 20;
export const MAX_TABULAR_ROWS = 500;

export const DOCUMENT_MIME_ALLOWLIST = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;
