import { ImagePart, UIMessage } from 'ai';
import { MediaItem } from '@app/contracts';
import {
  DOCUMENT_MIME_ALLOWLIST,
  IMAGE_MIME_ALLOWLIST,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  MIN_EXTRACTED_CHARS,
} from './media.constants';

/**
 * Computes the decoded byte length of a base64-encoded string.
 * Accounts for `=` and `==` padding characters.
 *
 * NOTE: this expects the RAW base64 payload only — NOT a full data URL.
 * Callers (e.g. `validateImageParts`) MUST strip any `data:<mime>;base64,`
 * prefix before calling. If a `data:` prefixed string is passed, the returned
 * count includes the prefix bytes and will be wrong; that is the caller's
 * contract violation, not handled here.
 */
export function base64Bytes(base64: string): number {
  if (!base64) return 0;
  const len = base64.length;
  // Each base64 char represents 6 bits → 4 chars = 3 bytes
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * Converts a raw base64 string + MIME type into an AI SDK ImagePart
 * compatible with gpt-4o vision input.
 */
export function toImagePart(base64: string, mimetype: string): ImagePart {
  return {
    type: 'image',
    image: `data:${mimetype};base64,${base64}`,
    mediaType: mimetype,
  };
}

/**
 * Validates an array of FileUIPart-like objects and returns the corresponding
 * MediaItem[] metadata array. Throws a plain Error on any violation so callers
 * can wrap it in an AppException at the controller boundary.
 *
 * Checks:
 *  - count ≤ MAX_IMAGES
 *  - url starts with "data:" (not a blob: URL)
 *  - mediaType in IMAGE_MIME_ALLOWLIST
 *  - decoded size ≤ MAX_IMAGE_BYTES
 */
export function validateImageParts(
  parts: Array<{ type: 'file'; mediaType: string; filename?: string; url: string }>,
): MediaItem[] {
  if (parts.length > MAX_IMAGES) {
    throw new Error(`Too many images: maximum ${MAX_IMAGES} allowed, got ${parts.length}.`);
  }

  return parts.map((part) => {
    if (!part.url.startsWith('data:')) {
      throw new Error(`Image URL must be a data URL (got: ${part.url.slice(0, 30)}...).`);
    }

    const mime = part.mediaType;
    if (!(IMAGE_MIME_ALLOWLIST as readonly string[]).includes(mime)) {
      throw new Error(
        `Unsupported image type: ${mime}. Allowed: ${IMAGE_MIME_ALLOWLIST.join(', ')}.`,
      );
    }

    // Extract the base64 payload after the comma in "data:<mime>;base64,<payload>"
    const commaIdx = part.url.indexOf(',');
    const b64 = commaIdx >= 0 ? part.url.slice(commaIdx + 1) : '';
    const size = base64Bytes(b64);

    if (size > MAX_IMAGE_BYTES) {
      throw new Error(`Image too large: ${size} bytes exceeds the ${MAX_IMAGE_BYTES}-byte limit.`);
    }

    return {
      type: 'image' as const,
      mediaType: mime,
      filename: part.filename ?? null,
      size,
    };
  });
}

/**
 * Validates a document attachment and returns the corresponding MediaItem metadata.
 * Throws a plain Error on any violation so callers can wrap it in an AppException
 * at the controller/service boundary.
 *
 * Checks:
 *  - mediaType in DOCUMENT_MIME_ALLOWLIST
 *  - For web data-URL path: url starts with "data:"; decoded size ≤ MAX_DOCUMENT_BYTES
 *  - For WhatsApp path (size provided directly): size ≤ MAX_DOCUMENT_BYTES
 *
 * pageCount is intentionally NOT set here — it is filled by the caller after
 * text extraction (only relevant for PDFs).
 */
export function validateDocument(part: {
  mediaType: string;
  filename?: string | null;
  url?: string;
  size?: number;
}): MediaItem {
  const mime = part.mediaType;

  if (!(DOCUMENT_MIME_ALLOWLIST as readonly string[]).includes(mime)) {
    throw new Error(
      `Unsupported document type: ${mime}. Allowed: ${DOCUMENT_MIME_ALLOWLIST.join(', ')}.`,
    );
  }

  let size: number;

  if (part.url !== undefined) {
    // Web data-URL path
    if (!part.url.startsWith('data:')) {
      throw new Error(`Document URL must be a data URL (got: ${part.url.slice(0, 30)}...).`);
    }
    const commaIdx = part.url.indexOf(',');
    const b64 = commaIdx >= 0 ? part.url.slice(commaIdx + 1) : '';
    size = base64Bytes(b64);
  } else if (part.size !== undefined) {
    // WhatsApp path — size already decoded
    size = part.size;
  } else {
    size = 0;
  }

  if (size > MAX_DOCUMENT_BYTES) {
    throw new Error(
      `Document too large: ${size} bytes exceeds the ${MAX_DOCUMENT_BYTES}-byte limit.`,
    );
  }

  return {
    type: 'document' as const,
    mediaType: mime,
    filename: part.filename ?? null,
    size,
  };
}

/**
 * Returns true when the extracted text is empty or below the minimum viable
 * length, which indicates a scanned/image-only document that cannot be read
 * as text. Callers should reply with a localized "can't read as text" message
 * and skip the model call.
 */
export function isLowText(text: string): boolean {
  return text.trim().length < MIN_EXTRACTED_CHARS;
}

/**
 * Replaces file (image/document) binary parts with a short text placeholder in
 * every message in `messages` EXCEPT the last user message. Text, tool, and all
 * other part types are left intact.
 *
 * This is the cost-guardrail that prevents file binaries from being replayed
 * into the model on subsequent turns, while preserving conversational context
 * via a textual note (e.g. `[image: receipt.jpg]` or `[document: statement.pdf]`).
 * Replacing — rather than dropping — also guarantees a file-only turn never
 * becomes `parts: []`, which downstream `convertToModelMessages` would reject.
 *
 * Label selection:
 * - If the file's mediaType matches document-like MIME patterns → `[document: <label>]`
 * - Otherwise → `[image: <label>]`
 *
 * Inputs are never mutated. Messages with no file parts are returned by
 * reference unchanged.
 */
export function stripMediaFromHistory(messages: UIMessage[]): UIMessage[] {
  if (messages.length === 0) return [];

  // Find the index of the last user message
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIdx = i;
      break;
    }
  }

  return messages.map((msg, idx) => {
    // Last user message: keep everything intact
    if (idx === lastUserIdx) return msg;

    // No file parts → no change, return same reference
    if (!msg.parts.some((p) => p.type === 'file')) return msg;

    // Replace each file binary part with a short text placeholder,
    // keeping all other parts (text, tool, …) in their original position.
    const mappedParts = msg.parts.map((p) => {
      if (p.type !== 'file') return p;
      const filePart = p as { type: 'file'; mediaType?: string; filename?: string };
      const label = filePart.filename ?? filePart.mediaType ?? 'file';
      const isDoc = (filePart.mediaType ?? '').match(/pdf|word|sheet|csv|excel|document/i);
      const prefix = isDoc ? 'document' : 'image';
      return { type: 'text' as const, text: `[${prefix}: ${label}]` };
    });

    return { ...msg, parts: mappedParts as UIMessage['parts'] };
  });
}

/**
 * @deprecated Use `stripMediaFromHistory` instead. This alias is kept for one
 * release to avoid churn at the single import site (chat.controller.ts).
 * It delegates directly to `stripMediaFromHistory` with identical behavior.
 */
export const stripImagesFromHistory = stripMediaFromHistory;
