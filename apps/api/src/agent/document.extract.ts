import { MAX_EXTRACTED_CHARS, MAX_PDF_PAGES, MAX_TABULAR_ROWS } from './media.constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractResult {
  /** Extracted text, already char-capped and ready to inject into the model turn. */
  text: string;
  /** PDF only — undefined for DOCX/CSV/XLSX. */
  pageCount?: number;
  /** True when char cap or page cap clipped the output. */
  truncated: boolean;
}

// ── Error type ────────────────────────────────────────────────────────────────

export class DocumentExtractionError extends Error {
  override name = 'DocumentExtractionError';

  constructor(message: string, cause?: Error) {
    super(message);
    if (cause) this.cause = cause;
  }
}

// ── Tabular serializer (shared by CSV + XLSX) ─────────────────────────────────

/**
 * Serializes a 2-D array of cell values into a compact pipe-delimited text block.
 * Prefixes the block with `# <sheetName>` to provide context to the model.
 *
 * Rules:
 * - Empty / null cells are coerced to empty string.
 * - Trailing all-empty columns in each row are trimmed.
 * - Rows beyond MAX_TABULAR_ROWS are omitted with a notice.
 */
export function serializeRows(sheetName: string, rows: string[][]): string {
  if (rows.length === 0) return `# ${sheetName}\n`;

  const truncated = rows.length > MAX_TABULAR_ROWS;
  const omitted = truncated ? rows.length - MAX_TABULAR_ROWS : 0;
  const capped = truncated ? rows.slice(0, MAX_TABULAR_ROWS) : rows;

  const lines: string[] = [`# ${sheetName}`];

  for (const row of capped) {
    // Coerce nullish cells to empty string
    const cells = row.map((cell) => (cell == null ? '' : String(cell)));

    // Find the last non-empty cell index to trim trailing empties
    let lastNonEmpty = cells.length - 1;
    while (lastNonEmpty >= 0 && cells[lastNonEmpty].trim() === '') {
      lastNonEmpty--;
    }

    const trimmed = lastNonEmpty >= 0 ? cells.slice(0, lastNonEmpty + 1) : cells;
    lines.push(trimmed.join(' | '));
  }

  if (truncated) {
    lines.push(`… (${omitted} more rows omitted)`);
  }

  return lines.join('\n');
}

// ── Per-format extractors (internal) ─────────────────────────────────────────

async function extractPdf(
  buffer: Buffer,
): Promise<{ text: string; pageCount: number; truncated: boolean }> {
  // pdf-parse v2 (>=2.x) is ESM-first and exports a `PDFParse` class.
  // The CJS entry (`require('pdf-parse')`) exposes `{ PDFParse }`.
  // `getText({ first: N })` parses only the first N pages and returns a
  // `TextResult` with `.text` (concatenated) and `.total` (total page count).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('pdf-parse') as {
    PDFParse: new (options: { data: Buffer }) => {
      getText: (params?: { first?: number }) => Promise<{ text: string; total: number }>;
      destroy: () => Promise<void>;
    };
  };
  const PDFParse = mod.PDFParse;

  const parser = new PDFParse({ data: buffer });
  try {
    const res = await parser.getText({ first: MAX_PDF_PAGES });
    // `res.total` is the document's total page count; the parser only returned
    // the first MAX_PDF_PAGES pages, so flag truncation when there are more.
    const pageTruncated = res.total > MAX_PDF_PAGES;

    return {
      text: res.text,
      pageCount: res.total,
      truncated: pageTruncated,
    };
  } finally {
    await parser.destroy?.();
  }
}

async function extractDocx(buffer: Buffer): Promise<{ text: string }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth') as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }>;
  };
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value };
}

/**
 * Parses CSV content per RFC-4180. Correctly handles:
 * - quoted fields containing commas (`"Cafe, Lima"`)
 * - quoted fields containing embedded newlines (CR/LF)
 * - escaped quotes inside quoted fields (`""` → `"`)
 *
 * Both `\n` and `\r\n` line endings are accepted as record separators.
 * Fully empty rows (a single empty unquoted field) are dropped to match the
 * previous "skip blank lines" behavior. Parsing stops early once
 * MAX_TABULAR_ROWS non-empty rows have been collected.
 */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let fieldStarted = false;

  const pushField = () => {
    row.push(field);
    field = '';
    fieldStarted = false;
  };

  const pushRow = () => {
    pushField();
    // Drop fully empty rows (single empty unquoted field).
    const isEmpty = row.length === 1 && row[0] === '';
    if (!isEmpty) rows.push(row);
    row = [];
  };

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }

    if (char === ',') {
      pushField();
      continue;
    }

    if (char === '\r') {
      // Treat CRLF and lone CR as a single record separator.
      if (content[i + 1] === '\n') i++;
      pushRow();
      if (rows.length >= MAX_TABULAR_ROWS) return rows;
      continue;
    }

    if (char === '\n') {
      pushRow();
      if (rows.length >= MAX_TABULAR_ROWS) return rows;
      continue;
    }

    field += char;
    fieldStarted = true;
  }

  // Flush trailing field/row if the content did not end with a newline.
  if (field !== '' || row.length > 0) {
    pushRow();
  }

  return rows;
}

function extractCsv(buffer: Buffer): { text: string } {
  const content = buffer.toString('utf-8');
  const rows = parseCsv(content);
  return { text: serializeRows('CSV', rows) };
}

function extractXlsx(buffer: Buffer): { text: string } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as {
    read: (buf: Buffer, opts: object) => { SheetNames: string[]; Sheets: Record<string, object> };
    utils: { sheet_to_json: (sheet: object, opts: object) => unknown[][] };
  };

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { text: '' };

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];

  return { text: serializeRows(firstSheetName, rows) };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Extracts text from a document buffer based on its MIME type.
 *
 * 1. Routes to the correct per-format extractor.
 * 2. Wraps parser errors in `DocumentExtractionError`.
 * 3. Applies the char cap centrally (MAX_EXTRACTED_CHARS) and sets `truncated`.
 *
 * Low-text detection is intentionally left to the caller so channel adapters
 * can choose the appropriate localized message without coupling it here.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractResult> {
  let raw: { text: string; pageCount?: number; truncated?: boolean };

  try {
    switch (mimeType) {
      case 'application/pdf':
        raw = await extractPdf(buffer);
        break;

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        raw = await extractDocx(buffer);
        break;

      case 'text/csv':
        raw = extractCsv(buffer);
        break;

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        raw = extractXlsx(buffer);
        break;

      default:
        throw new DocumentExtractionError(`Unsupported MIME type for text extraction: ${mimeType}`);
    }
  } catch (err) {
    if (err instanceof DocumentExtractionError) throw err;
    throw new DocumentExtractionError(
      `Failed to extract text from document (${mimeType}): ${(err as Error).message}`,
      err as Error,
    );
  }

  // Apply char cap centrally
  const charTruncated = raw.text.length > MAX_EXTRACTED_CHARS;
  const text = charTruncated ? raw.text.slice(0, MAX_EXTRACTED_CHARS) : raw.text;
  const truncated = !!(raw.truncated || charTruncated);

  return {
    text,
    pageCount: raw.pageCount,
    truncated,
  };
}
