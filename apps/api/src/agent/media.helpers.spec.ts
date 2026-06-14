import { UIMessage } from 'ai';
import { MediaItem } from '@app/contracts';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  MAX_DOCUMENT_BYTES,
  MIN_EXTRACTED_CHARS,
  DOCUMENT_MIME_ALLOWLIST,
} from './media.constants';
import {
  base64Bytes,
  stripImagesFromHistory,
  stripMediaFromHistory,
  toImagePart,
  validateImageParts,
  validateDocument,
  isLowText,
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

  it('treats a data: prefixed string as raw input (caller must strip prefix)', () => {
    // base64Bytes expects the RAW payload only. If a full data URL is passed,
    // the byte count includes the prefix bytes and is therefore NOT equal to
    // the byte count of the underlying payload. This documents the contract:
    // callers (validateImageParts) strip the prefix before calling.
    const payload = makeBase64OfSize(100);
    const dataUrl = makeDataUrl('image/jpeg', payload);
    expect(base64Bytes(dataUrl)).not.toBe(base64Bytes(payload));
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

  it('accepts EXACTLY 2 images (count boundary inclusive)', () => {
    const parts = [
      makeFilePart('image/jpeg', 100, 'a.jpg'),
      makeFilePart('image/png', 100, 'b.png'),
    ];
    expect(() => validateImageParts(parts)).not.toThrow();
    expect(validateImageParts(parts)).toHaveLength(2);
  });

  it('rejects 3 images (one over the count boundary)', () => {
    const parts = [
      makeFilePart('image/jpeg', 100, 'a.jpg'),
      makeFilePart('image/jpeg', 100, 'b.jpg'),
      makeFilePart('image/jpeg', 100, 'c.jpg'),
    ];
    expect(() => validateImageParts(parts)).toThrow();
  });

  it('accepts an image at EXACTLY MAX_IMAGE_BYTES (size boundary inclusive)', () => {
    const atLimit = makeFilePart('image/jpeg', MAX_IMAGE_BYTES, 'exact.jpg');
    expect(() => validateImageParts([atLimit])).not.toThrow();
    const [item] = validateImageParts([atLimit]);
    expect(item.size).toBe(MAX_IMAGE_BYTES);
  });

  it('rejects an image one byte over MAX_IMAGE_BYTES', () => {
    const overLimit = makeFilePart('image/jpeg', MAX_IMAGE_BYTES + 1, 'over.jpg');
    expect(() => validateImageParts([overLimit])).toThrow();
  });

  it('fails fast on a mix of valid and invalid parts', () => {
    const valid = makeFilePart('image/jpeg', 100, 'ok.jpg');
    const invalid = {
      type: 'file' as const,
      mediaType: 'application/pdf',
      filename: 'doc.pdf',
      url: 'data:application/pdf;base64,dGVzdA==',
    };
    // A single invalid part must cause the whole call to reject.
    expect(() => validateImageParts([valid, invalid])).toThrow();
    expect(() => validateImageParts([invalid, valid])).toThrow();
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
  it('replaces file parts with a text placeholder in all messages except the last user message', () => {
    const older = makeMessage(
      'user',
      [...makeFileParts(1), makeTextPart('here is a receipt')],
      'old',
    );
    const last = makeMessage('user', [...makeFileParts(1), makeTextPart('and this one')], 'last');
    const result = stripImagesFromHistory([older, last]);

    // older user message: file part replaced by placeholder, original text kept
    const olderResult = result.find((m) => m.id === 'old')!;
    expect(olderResult.parts.some((p) => p.type === 'file')).toBe(false);
    expect(olderResult.parts.some((p) => p.type === 'text' && p.text.startsWith('[image:'))).toBe(
      true,
    );
    expect(olderResult.parts.some((p) => p.type === 'text' && p.text === 'here is a receipt')).toBe(
      true,
    );
    // No empty turn — count is preserved (image → placeholder, text stays)
    expect(olderResult.parts).toHaveLength(2);

    // last user message: file part kept intact
    const lastResult = result.find((m) => m.id === 'last')!;
    expect(lastResult.parts.some((p) => p.type === 'file')).toBe(true);
  });

  it('turns an image-only message into exactly one text placeholder part (filename used)', () => {
    const imageOnly = makeMessage('user', [...makeFileParts(1)], 'io');
    const lastUser = makeMessage('user', [makeTextPart('thanks')], 'lu');
    const result = stripImagesFromHistory([imageOnly, lastUser]);

    const ioResult = result.find((m) => m.id === 'io')!;
    expect(ioResult.parts).toHaveLength(1);
    const [part] = ioResult.parts;
    expect(part.type).toBe('text');
    expect((part as { text: string }).text).toBe('[image: img.jpg]');
  });

  it('uses mediaType as the placeholder label when no filename is present', () => {
    const noNamePart = {
      type: 'file' as const,
      mediaType: 'image/png',
      url: makeDataUrl('image/png', makeBase64OfSize(100)),
    };
    const imageOnly = makeMessage('user', [noNamePart] as UIMessage['parts'], 'io');
    const lastUser = makeMessage('user', [makeTextPart('thanks')], 'lu');
    const result = stripImagesFromHistory([imageOnly, lastUser]);

    const ioResult = result.find((m) => m.id === 'io')!;
    expect(ioResult.parts).toHaveLength(1);
    expect((ioResult.parts[0] as { text: string }).text).toBe('[image: image/png]');
  });

  it('replaces the image in-position in a mixed text+image message', () => {
    const mixed = makeMessage(
      'user',
      [makeTextPart('before'), ...makeFileParts(1), makeTextPart('after')],
      'mx',
    );
    const lastUser = makeMessage('user', [makeTextPart('thanks')], 'lu');
    const result = stripImagesFromHistory([mixed, lastUser]);

    const mxResult = result.find((m) => m.id === 'mx')!;
    expect(mxResult.parts).toHaveLength(3);
    expect((mxResult.parts[0] as { text: string }).text).toBe('before');
    expect(mxResult.parts[1].type).toBe('text');
    expect((mxResult.parts[1] as { text: string }).text).toBe('[image: img.jpg]');
    expect((mxResult.parts[2] as { text: string }).text).toBe('after');
  });

  it('does not mutate the input messages', () => {
    const older = makeMessage('user', [...makeFileParts(1), makeTextPart('hi')], 'old');
    const lastUser = makeMessage('user', [makeTextPart('thanks')], 'lu');
    const before = JSON.parse(JSON.stringify(older.parts));
    stripImagesFromHistory([older, lastUser]);
    expect(JSON.parse(JSON.stringify(older.parts))).toEqual(before);
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

// ── B6: validateDocument ──────────────────────────────────────────────────────

describe('validateDocument', () => {
  const validMime = DOCUMENT_MIME_ALLOWLIST[0]; // 'application/pdf'
  const docxMime = DOCUMENT_MIME_ALLOWLIST[1]; // docx

  function makeDocDataUrl(mime: string, sizeBytes: number): string {
    const buf = Buffer.alloc(sizeBytes, 0);
    const b64 = buf.toString('base64');
    return `data:${mime};base64,${b64}`;
  }

  it('accepts a valid PDF within size limit and returns MediaItem with type=document', () => {
    const url = makeDocDataUrl(validMime, 100);
    const result = validateDocument({ mediaType: validMime, filename: 'statement.pdf', url });
    const item: MediaItem = result;
    expect(item.type).toBe('document');
    expect(item.mediaType).toBe(validMime);
    expect(item.filename).toBe('statement.pdf');
    expect(typeof item.size).toBe('number');
    expect(item.size).toBeGreaterThan(0);
  });

  it('accepts all DOCUMENT_MIME_ALLOWLIST types', () => {
    for (const mime of DOCUMENT_MIME_ALLOWLIST) {
      const url = makeDocDataUrl(mime, 100);
      expect(() => validateDocument({ mediaType: mime, url })).not.toThrow();
    }
  });

  it('throws when MIME type is not in DOCUMENT_MIME_ALLOWLIST', () => {
    const url = makeDocDataUrl('application/octet-stream', 100);
    expect(() => validateDocument({ mediaType: 'application/octet-stream', url })).toThrow();
  });

  it('throws when image MIME type is given', () => {
    const url = makeDocDataUrl('image/jpeg', 100);
    expect(() => validateDocument({ mediaType: 'image/jpeg', url })).toThrow();
  });

  it('throws when url does not start with data:', () => {
    expect(() =>
      validateDocument({
        mediaType: validMime,
        url: 'blob:http://localhost/abc',
      }),
    ).toThrow();
  });

  it('accepts file at exactly MAX_DOCUMENT_BYTES (size boundary inclusive)', () => {
    const url = makeDocDataUrl(validMime, MAX_DOCUMENT_BYTES);
    expect(() => validateDocument({ mediaType: validMime, url })).not.toThrow();
    const item = validateDocument({ mediaType: validMime, url });
    expect(item.size).toBe(MAX_DOCUMENT_BYTES);
  });

  it('throws when file exceeds MAX_DOCUMENT_BYTES', () => {
    const url = makeDocDataUrl(validMime, MAX_DOCUMENT_BYTES + 1);
    expect(() => validateDocument({ mediaType: validMime, url })).toThrow();
  });

  it('accepts a WhatsApp-style call (size provided directly, no url)', () => {
    const result = validateDocument({
      mediaType: docxMime,
      filename: 'report.docx',
      size: 1024,
    });
    expect(result.type).toBe('document');
    expect(result.size).toBe(1024);
  });

  it('throws when WhatsApp-style size exceeds MAX_DOCUMENT_BYTES', () => {
    expect(() =>
      validateDocument({ mediaType: validMime, size: MAX_DOCUMENT_BYTES + 1 }),
    ).toThrow();
  });

  it('returns null filename when not provided', () => {
    const url = makeDocDataUrl(validMime, 100);
    const item = validateDocument({ mediaType: validMime, url });
    expect(item.filename).toBeNull();
  });

  it('does not include pageCount (caller fills it after extraction)', () => {
    const url = makeDocDataUrl(validMime, 100);
    const item = validateDocument({ mediaType: validMime, url });
    // pageCount should not be set by validateDocument
    expect((item as { pageCount?: number }).pageCount).toBeUndefined();
  });
});

// ── B7: isLowText ─────────────────────────────────────────────────────────────

describe('isLowText', () => {
  it('returns true when text is empty', () => {
    expect(isLowText('')).toBe(true);
  });

  it('returns true when text is whitespace-only', () => {
    expect(isLowText('   \n\t  ')).toBe(true);
  });

  it('returns true when trimmed text is below MIN_EXTRACTED_CHARS', () => {
    const shortText = 'a'.repeat(MIN_EXTRACTED_CHARS - 1);
    expect(isLowText(shortText)).toBe(true);
  });

  it('returns false when trimmed text equals MIN_EXTRACTED_CHARS', () => {
    const atThreshold = 'a'.repeat(MIN_EXTRACTED_CHARS);
    expect(isLowText(atThreshold)).toBe(false);
  });

  it('returns false when text is well above MIN_EXTRACTED_CHARS', () => {
    expect(isLowText('This is a normal document with enough text to read.')).toBe(false);
  });

  it('returns true for a single character (below threshold)', () => {
    expect(isLowText('x')).toBe(true);
  });

  it('returns true for text with only newlines', () => {
    expect(isLowText('\n\n\n\n\n')).toBe(true);
  });
});

// ── B8: stripMediaFromHistory ─────────────────────────────────────────────────

function makeDocFilePart(filename = 'statement.pdf', mime = 'application/pdf') {
  return {
    type: 'file' as const,
    mediaType: mime,
    filename,
    url: 'data:application/pdf;base64,dGVzdA==',
  };
}

function makeImageFilePart(filename = 'photo.jpg', mime = 'image/jpeg') {
  return {
    type: 'file' as const,
    mediaType: mime,
    filename,
    url: makeDataUrl(mime, makeBase64OfSize(100)),
  };
}

describe('stripMediaFromHistory', () => {
  it('replaces image file parts with [image: <label>] placeholder in older messages', () => {
    const older = makeMessage('user', [makeImageFilePart() as UIMessage['parts'][number]], 'old');
    const last = makeMessage('user', [makeTextPart('hello')], 'last');
    const result = stripMediaFromHistory([older, last]);

    const olderResult = result.find((m) => m.id === 'old')!;
    expect(olderResult.parts).toHaveLength(1);
    expect((olderResult.parts[0] as { text: string }).text).toMatch(/^\[image:/);
  });

  it('replaces document file parts with [document: <label>] placeholder in older messages', () => {
    const older = makeMessage('user', [makeDocFilePart() as UIMessage['parts'][number]], 'old');
    const last = makeMessage('user', [makeTextPart('hello')], 'last');
    const result = stripMediaFromHistory([older, last]);

    const olderResult = result.find((m) => m.id === 'old')!;
    expect(olderResult.parts).toHaveLength(1);
    expect((olderResult.parts[0] as { text: string }).text).toMatch(/^\[document:/);
  });

  it('uses the filename in the document placeholder', () => {
    const older = makeMessage(
      'user',
      [makeDocFilePart('bank-statement.pdf') as UIMessage['parts'][number]],
      'old',
    );
    const last = makeMessage('user', [makeTextPart('hi')], 'last');
    const result = stripMediaFromHistory([older, last]);

    const olderResult = result.find((m) => m.id === 'old')!;
    expect((olderResult.parts[0] as { text: string }).text).toBe('[document: bank-statement.pdf]');
  });

  it('handles mixed image + document in the same older message', () => {
    const older = makeMessage(
      'user',
      [
        makeImageFilePart('receipt.jpg') as UIMessage['parts'][number],
        makeDocFilePart('statement.pdf') as UIMessage['parts'][number],
      ],
      'old',
    );
    const last = makeMessage('user', [makeTextPart('hi')], 'last');
    const result = stripMediaFromHistory([older, last]);

    const olderResult = result.find((m) => m.id === 'old')!;
    const texts = olderResult.parts.map((p) => (p as { text: string }).text);
    expect(texts.some((t) => t.startsWith('[image:'))).toBe(true);
    expect(texts.some((t) => t.startsWith('[document:'))).toBe(true);
  });

  it('leaves the last user message intact', () => {
    const last = makeMessage(
      'user',
      [makeDocFilePart() as UIMessage['parts'][number], makeTextPart('summarize this')],
      'last',
    );
    const result = stripMediaFromHistory([last]);
    const lastResult = result.find((m) => m.id === 'last')!;
    expect(lastResult.parts.some((p) => p.type === 'file')).toBe(true);
  });

  it('returns same reference for messages with no file parts (no mutation)', () => {
    const msg = makeMessage('user', [makeTextPart('just text')], 'pure');
    const last = makeMessage('user', [makeTextPart('hello')], 'last');
    const result = stripMediaFromHistory([msg, last]);
    expect(result.find((m) => m.id === 'pure')).toBe(msg);
  });

  it('does not mutate input messages', () => {
    const older = makeMessage('user', [makeDocFilePart() as UIMessage['parts'][number]], 'old');
    const last = makeMessage('user', [makeTextPart('hi')], 'last');
    const before = JSON.parse(JSON.stringify(older.parts));
    stripMediaFromHistory([older, last]);
    expect(JSON.parse(JSON.stringify(older.parts))).toEqual(before);
  });

  it('returns empty array unchanged', () => {
    expect(stripMediaFromHistory([])).toHaveLength(0);
  });

  it('handles DOCX mime type as document placeholder', () => {
    const older = makeMessage(
      'user',
      [
        makeDocFilePart(
          'report.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ) as UIMessage['parts'][number],
      ],
      'old',
    );
    const last = makeMessage('user', [makeTextPart('hi')], 'last');
    const result = stripMediaFromHistory([older, last]);
    const olderResult = result.find((m) => m.id === 'old')!;
    expect((olderResult.parts[0] as { text: string }).text).toMatch(/^\[document:/);
  });

  it('preserves existing image behavior: uses filename as label', () => {
    const older = makeMessage(
      'user',
      [makeImageFilePart('myreceipt.jpg') as UIMessage['parts'][number]],
      'old',
    );
    const last = makeMessage('user', [makeTextPart('hi')], 'last');
    const result = stripMediaFromHistory([older, last]);
    const olderResult = result.find((m) => m.id === 'old')!;
    expect((olderResult.parts[0] as { text: string }).text).toBe('[image: myreceipt.jpg]');
  });
});
