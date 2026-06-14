import { ImagePart, UIMessage } from 'ai';
import { MediaItem } from '@app/contracts';
import { IMAGE_MIME_ALLOWLIST, MAX_IMAGE_BYTES, MAX_IMAGES } from './media.constants';

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
 * Replaces file (image) binary parts with a short text placeholder in every
 * message in `messages` EXCEPT the last user message. Text, tool, and all other
 * part types are left intact.
 *
 * This is the cost-guardrail that prevents image binaries from being replayed
 * into the model on subsequent turns, while preserving conversational context
 * via a textual note (e.g. `[image: receipt.jpg]`). Replacing — rather than
 * dropping — also guarantees an image-only turn never becomes `parts: []`,
 * which downstream `convertToModelMessages` would reject.
 *
 * Inputs are never mutated. Messages with no image parts are returned by
 * reference unchanged.
 */
export function stripImagesFromHistory(messages: UIMessage[]): UIMessage[] {
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

    // No image parts → no change, return same reference
    if (!msg.parts.some((p) => p.type === 'file')) return msg;

    // Replace each image/file binary part with a short text placeholder,
    // keeping all other parts (text, tool, …) in their original position.
    const mappedParts = msg.parts.map((p) => {
      if (p.type !== 'file') return p;
      const filePart = p as { type: 'file'; mediaType?: string; filename?: string };
      const label = filePart.filename ?? filePart.mediaType ?? 'image';
      return { type: 'text' as const, text: `[image: ${label}]` };
    });

    return { ...msg, parts: mappedParts as UIMessage['parts'] };
  });
}
