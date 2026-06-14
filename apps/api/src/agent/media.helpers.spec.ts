import { UIMessage } from 'ai';
import { MediaItem } from '@app/contracts';
import { MAX_IMAGE_BYTES, MAX_IMAGES } from './media.constants';
import {
  base64Bytes,
  stripImagesFromHistory,
  toImagePart,
  validateImageParts,
} from './media.helpers';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal base64 string of approximately `bytes` bytes when decoded.
 * Real base64: each char = 6 bits → 4 chars encode 3 bytes.
 * ceil(bytes / 3) * 4 chars → decoded ≈ bytes (within a few due to padding).
 */
function makeBase64OfSize(bytes: number): string {
  const buf = Buffer.alloc(bytes, 0);
  return buf.toString('base64');
}

/** Builds a data-URL with the given mime and base64 payload. */
function makeDataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}

/** Builds a minimal FileUIPart for testing. */
function makeFilePart(mime = 'image/jpeg', sizeBytes = 100, filename = 'img.jpg') {
  const b64 = makeBase64OfSize(sizeBytes);
  return {
    type: 'file' as const,
    mediaType: mime,
    filename,
    url: makeDataUrl(mime, b64),
  };
}

// ── B2: base64Bytes ───────────────────────────────────────────────────────────

describe('base64Bytes', () => {
  it('returns correct byte count for a string with no padding', () => {
    // "Man" encodes to "TWFu" — 3 bytes, no padding
    expect(base64Bytes('TWFu')).toBe(3);
  });

  it('returns correct byte count for a string with single = padding', () => {
    // "Ma" → "TWE=" — 2 bytes
    expect(base64Bytes('TWE=')).toBe(2);
  });

  it('returns correct byte count for a string with == padding', () => {
    // "M" → "TQ==" — 1 byte
    expect(base64Bytes('TQ==')).toBe(1);
  });

  it('returns 0 for an empty string', () => {
    expect(base64Bytes('')).toBe(0);
  });

  it('returns correct byte count for a large buffer', () => {
    const buf = Buffer.alloc(1024, 0);
    const b64 = buf.toString('base64');
    expect(base64Bytes(b64)).toBe(1024);
  });
});

// ── B3: toImagePart ───────────────────────────────────────────────────────────

describe('toImagePart', () => {
  const base64 = 'TWFu'; // "Man"
  const mime = 'image/jpeg';

  it('builds a data URL as the image field', () => {
    const part = toImagePart(base64, mime);
    expect(part.image).toBe(`data:${mime};base64,${base64}`);
  });

  it('sets type to image', () => {
    const part = toImagePart(base64, mime);
    expect(part.type).toBe('image');
  });

  it('sets mediaType from the mime argument', () => {
    const part = toImagePart(base64, mime);
    expect(part.mediaType).toBe(mime);
  });

  it('handles image/png correctly', () => {
    const part = toImagePart(base64, 'image/png');
    expect(part.image).toBe(`data:image/png;base64,${base64}`);
    expect(part.mediaType).toBe('image/png');
  });

  it('handles image/webp correctly', () => {
    const part = toImagePart(base64, 'image/webp');
    expect(part.mediaType).toBe('image/webp');
  });
});

// ── B4: validateImageParts ────────────────────────────────────────────────────

describe('validateImageParts', () => {
  it('accepts one valid image and returns correct MediaItem[]', () => {
    const part = makeFilePart('image/jpeg', 100, 'receipt.jpg');
    const result = validateImageParts([part]);
    expect(result).toHaveLength(1);
    const item: MediaItem = result[0];
    expect(item.type).toBe('image');
    expect(item.mediaType).toBe('image/jpeg');
    expect(item.filename).toBe('receipt.jpg');
    expect(typeof item.size).toBe('number');
    expect(item.size).toBeGreaterThan(0);
  });

  it('accepts two valid images and returns correct MediaItem[]', () => {
    const part1 = makeFilePart('image/jpeg', 100, 'a.jpg');
    const part2 = makeFilePart('image/png', 200, 'b.png');
    const result = validateImageParts([part1, part2]);
    expect(result).toHaveLength(2);
    expect(result[0].mediaType).toBe('image/jpeg');
    expect(result[1].mediaType).toBe('image/png');
  });

  it('returns empty array when no file parts are provided', () => {
    const result = validateImageParts([]);
    expect(result).toHaveLength(0);
  });

  it('throws when more than MAX_IMAGES images are provided', () => {
    const parts = [
      makeFilePart('image/jpeg', 100, 'a.jpg'),
      makeFilePart('image/jpeg', 100, 'b.jpg'),
      makeFilePart('image/jpeg', 100, 'c.jpg'),
    ];
    expect(() => validateImageParts(parts)).toThrow();
  });

  it('throws when an image exceeds MAX_IMAGE_BYTES', () => {
    const tooBig = makeFilePart('image/jpeg', MAX_IMAGE_BYTES + 1, 'big.jpg');
    expect(() => validateImageParts([tooBig])).toThrow();
  });

  it('throws when a file has a disallowed mime type', () => {
    const pdf = {
      type: 'file' as const,
      mediaType: 'application/pdf',
      filename: 'doc.pdf',
      url: 'data:application/pdf;base64,dGVzdA==',
    };
    expect(() => validateImageParts([pdf])).toThrow();
  });

  it('throws when a file url is not a data URL', () => {
    const blobPart = {
      type: 'file' as const,
      mediaType: 'image/jpeg',
      filename: 'img.jpg',
      url: 'blob:http://localhost/some-id',
    };
    expect(() => validateImageParts([blobPart])).toThrow();
  });

  it('MAX_IMAGES boundary: exactly MAX_IMAGES images is valid', () => {
    const parts = Array.from({ length: MAX_IMAGES }, (_, i) =>
      makeFilePart('image/jpeg', 100, `img${i}.jpg`),
    );
    expect(() => validateImageParts(parts)).not.toThrow();
    expect(validateImageParts(parts)).toHaveLength(MAX_IMAGES);
  });
});

// ── B5: stripImagesFromHistory ────────────────────────────────────────────────

function makeTextPart(text: string) {
  return { type: 'text' as const, text };
}

function makeFileParts(count = 1) {
  return Array.from({ length: count }, () => makeFilePart('image/jpeg', 100, 'img.jpg'));
}

function makeMessage(role: UIMessage['role'], parts: UIMessage['parts'], id = 'msg-1'): UIMessage {
  return { id, role, parts } as UIMessage;
}

describe('stripImagesFromHistory', () => {
  it('strips file parts from all messages except the last user message', () => {
    const older = makeMessage(
      'user',
      [...makeFileParts(1), makeTextPart('here is a receipt')],
      'old',
    );
    const last = makeMessage('user', [...makeFileParts(1), makeTextPart('and this one')], 'last');
    const result = stripImagesFromHistory([older, last]);

    // older user message: file part stripped, text part kept
    const olderResult = result.find((m) => m.id === 'old')!;
    expect(olderResult.parts.some((p) => p.type === 'file')).toBe(false);
    expect(olderResult.parts.some((p) => p.type === 'text')).toBe(true);

    // last user message: file part kept intact
    const lastResult = result.find((m) => m.id === 'last')!;
    expect(lastResult.parts.some((p) => p.type === 'file')).toBe(true);
  });

  it('leaves text parts intact for all messages and does not strip non-file parts', () => {
    const withText = makeMessage(
      'assistant',
      [makeTextPart('sure'), makeTextPart('also this')],
      'asst',
    );
    const result = stripImagesFromHistory([withText]);
    const asst = result.find((m) => m.id === 'asst')!;
    expect(asst.parts).toHaveLength(2);
    expect(asst.parts.every((p) => p.type === 'text')).toBe(true);
  });

  it('does NOT strip the last user message image parts', () => {
    const last = makeMessage('user', [...makeFileParts(2), makeTextPart('look')], 'last');
    const result = stripImagesFromHistory([last]);
    const lastResult = result.find((m) => m.id === 'last')!;
    expect(lastResult.parts.filter((p) => p.type === 'file')).toHaveLength(2);
  });

  it('handles history with no images (no-op)', () => {
    const m1 = makeMessage('user', [makeTextPart('hello')], 'm1');
    const m2 = makeMessage('assistant', [makeTextPart('hi')], 'm2');
    const result = stripImagesFromHistory([m1, m2]);
    expect(result).toHaveLength(2);
    expect(result[0].parts).toEqual(m1.parts);
    expect(result[1].parts).toEqual(m2.parts);
  });

  it('returns an empty array unchanged', () => {
    expect(stripImagesFromHistory([])).toHaveLength(0);
  });

  it('strips file parts from assistant messages too (cost guardrail)', () => {
    const asst = makeMessage(
      'assistant',
      [...makeFileParts(1), makeTextPart('here is the image info')],
      'asst',
    );
    const lastUser = makeMessage('user', [makeTextPart('thanks')], 'lu');
    const result = stripImagesFromHistory([asst, lastUser]);
    const asstResult = result.find((m) => m.id === 'asst')!;
    expect(asstResult.parts.some((p) => p.type === 'file')).toBe(false);
  });

  it('correctly identifies last user message when interleaved with assistant messages', () => {
    const oldUser = makeMessage('user', [...makeFileParts(1), makeTextPart('old')], 'ou');
    const asst = makeMessage('assistant', [makeTextPart('ok')], 'asst');
    const lastUser = makeMessage('user', [...makeFileParts(1), makeTextPart('new')], 'lu');
    const result = stripImagesFromHistory([oldUser, asst, lastUser]);

    // old user: stripped
    expect(result.find((m) => m.id === 'ou')!.parts.some((p) => p.type === 'file')).toBe(false);
    // assistant: no change (no files anyway)
    expect(result.find((m) => m.id === 'asst')!.parts).toHaveLength(1);
    // last user: kept
    expect(result.find((m) => m.id === 'lu')!.parts.some((p) => p.type === 'file')).toBe(true);
  });
});
