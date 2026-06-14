/** Shared guardrails for image attachments (both web and WhatsApp channels). */

export const MAX_IMAGES = 2;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
export const IMAGE_MIME_ALLOWLIST = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
