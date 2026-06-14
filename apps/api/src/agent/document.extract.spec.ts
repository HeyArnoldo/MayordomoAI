import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { MAX_TABULAR_ROWS, MAX_EXTRACTED_CHARS, MAX_PDF_PAGES } from './media.constants';
import {
  serializeRows,
  DocumentExtractionError,
  extractDocumentText,
  parseCsv,
} from './document.extract';

// ── serializeRows ─────────────────────────────────────────────────────────────

describe('serializeRows', () => {
  it('produces pipe-delimited output from a simple 2-row table', () => {
    const rows = [
      ['date', 'merchant', 'amount'],
      ['2026-01-03', 'Cafe Lima', '12.50'],
    ];
    const output = serializeRows('Sheet1', rows);
    expect(output).toContain('date | merchant | amount');
    expect(output).toContain('2026-01-03 | Cafe Lima | 12.50');
  });

  it('prefixes the output with a # sheetName header for XLSX blocks', () => {
    const rows = [['a', 'b']];
    const output = serializeRows('MySheet', rows);
    expect(output).toMatch(/^# MySheet/);
  });

  it('converts empty cells to empty string (no null or undefined leaking)', () => {
    const rows = [['col1', '', 'col3']];
    const output = serializeRows('S', rows);
    expect(output).toContain('col1 |  | col3');
    expect(output).not.toContain('null');
    expect(output).not.toContain('undefined');
  });

  it('truncates at MAX_TABULAR_ROWS and appends a notice', () => {
    const rows = Array.from({ length: MAX_TABULAR_ROWS + 10 }, (_, i) => [`row${i}`, 'val']);
    const output = serializeRows('S', rows);
    const noticeLines = output.split('\n').filter((l: string) => l.includes('more rows omitted'));
    expect(noticeLines).toHaveLength(1);
    expect(noticeLines[0]).toContain('10 more rows omitted');
  });

  it('does NOT append a truncation notice when rows fit within MAX_TABULAR_ROWS', () => {
    const rows = [
      ['h1', 'h2'],
      ['v1', 'v2'],
    ];
    const output = serializeRows('S', rows);
    expect(output).not.toContain('more rows omitted');
  });

  it('trims trailing all-empty columns', () => {
    const rows = [
      ['a', 'b', '', ''],
      ['1', '2', '', ''],
    ];
    const output = serializeRows('S', rows);
    // Output should contain a | b but NOT trailing pipes
    const lines = output.split('\n').filter((l: string) => l.includes('|'));
    lines.forEach((line: string) => {
      // trim whitespace then check no trailing pipe
      expect(line.trimEnd().endsWith('|')).toBe(false);
    });
  });

  it('handles an empty rows array gracefully', () => {
    const output = serializeRows('Empty', []);
    expect(typeof output).toBe('string');
  });

  it('treats a null cell value as empty string', () => {
    const rows = [['a', null as unknown as string, 'c']];
    const output = serializeRows('S', rows);
    expect(output).not.toContain('null');
  });
});

// ── DocumentExtractionError ───────────────────────────────────────────────────

describe('DocumentExtractionError', () => {
  it('is an instance of Error', () => {
    const err = new DocumentExtractionError('bad file');
    expect(err).toBeInstanceOf(Error);
  });

  it('carries the message', () => {
    const err = new DocumentExtractionError('corrupt zip');
    expect(err.message).toBe('corrupt zip');
  });

  it('has name DocumentExtractionError', () => {
    const err = new DocumentExtractionError('x');
    expect(err.name).toBe('DocumentExtractionError');
  });

  it('can wrap an original error as cause', () => {
    const cause = new Error('original');
    const err = new DocumentExtractionError('wrapped', cause);
    expect(err.cause).toBe(cause);
  });
});

// ── extractDocumentText dispatcher ───────────────────────────────────────────

// We mock the individual libraries so the dispatcher tests remain fast and
// isolated from I/O. Real round-trip tests (one per format) live at the end.

// pdf-parse v2 exposes a `PDFParse` CLASS whose `getText({ first })` resolves to
// a TextResult `{ text, total }`. The mock mirrors that real shape.
const mockGetText = jest.fn<Promise<{ text: string; total: number }>, [unknown?]>();
const mockDestroy = jest.fn<Promise<void>, []>();
jest.mock('pdf-parse', () => ({
  __esModule: true,
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: mockGetText,
    destroy: mockDestroy,
  })),
}));

// mammoth.extractRawText resolves to `{ value: string; messages: unknown[] }`,
// which is mammoth's REAL return shape. Kept mocked because producing a valid
// minimal .docx in-test is impractical; a real DOCX round-trip lives below.
jest.mock('mammoth', () => ({
  extractRawText: jest.fn(),
}));

jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}));

// Import after jest.mock so we get the mocked versions
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammothMod = require('mammoth');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const xlsxMod = require('xlsx');

const mockedMammothExtract = mammothMod.extractRawText as jest.MockedFunction<
  (opts: object) => Promise<{ value: string; messages: unknown[] }>
>;
const mockedXlsxRead = xlsxMod.read as jest.MockedFunction<(buf: Buffer, opts?: object) => object>;
const mockedSheetToJson = xlsxMod.utils.sheet_to_json as jest.MockedFunction<
  (sheet: object, opts?: object) => unknown[][]
>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('extractDocumentText dispatcher', () => {
  const fakeBuffer = Buffer.from('test');

  it('routes application/pdf to extractPdf and returns text + pageCount', async () => {
    mockGetText.mockResolvedValueOnce({ text: 'PDF content here', total: 5 });

    const result = await extractDocumentText(fakeBuffer, 'application/pdf');
    expect(result.text).toContain('PDF content here');
    expect(result.pageCount).toBe(5);
    expect(result.truncated).toBe(false);
    expect(mockGetText).toHaveBeenCalledTimes(1);
    expect(mockGetText).toHaveBeenCalledWith({ first: MAX_PDF_PAGES });
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('sets truncated=true when PDF page count exceeds MAX_PDF_PAGES', async () => {
    mockGetText.mockResolvedValueOnce({
      text: 'lots of text',
      total: MAX_PDF_PAGES + 5,
    });

    const result = await extractDocumentText(fakeBuffer, 'application/pdf');
    expect(result.truncated).toBe(true);
  });

  it('routes application/vnd...wordprocessingml.document to extractDocx', async () => {
    mockedMammothExtract.mockResolvedValueOnce({ value: 'DOCX body text', messages: [] });

    const result = await extractDocumentText(
      fakeBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(result.text).toContain('DOCX body text');
    expect(result.pageCount).toBeUndefined();
    expect(mockedMammothExtract).toHaveBeenCalledTimes(1);
  });

  it('routes text/csv to extractCsv and returns serialized rows', async () => {
    const csvBuffer = Buffer.from('header1,header2\nval1,val2\n');
    const result = await extractDocumentText(csvBuffer, 'text/csv');
    expect(result.text).toContain('header1 | header2');
    expect(result.text).toContain('val1 | val2');
    expect(result.pageCount).toBeUndefined();
  });

  it('routes application/vnd...spreadsheetml.sheet to extractXlsx', async () => {
    const mockSheet = { '!ref': 'A1:B2' };
    const mockWorkbook = {
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: mockSheet },
    };
    mockedXlsxRead.mockReturnValueOnce(mockWorkbook);
    mockedSheetToJson.mockReturnValueOnce([
      ['col1', 'col2'],
      ['a', 'b'],
    ] as unknown as unknown[][]);

    const result = await extractDocumentText(
      fakeBuffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(result.text).toContain('# Sheet1');
    expect(result.pageCount).toBeUndefined();
  });

  it('throws DocumentExtractionError for unknown MIME type', async () => {
    await expect(
      extractDocumentText(fakeBuffer, 'application/octet-stream'),
    ).rejects.toBeInstanceOf(DocumentExtractionError);
  });

  it('wraps parser errors in DocumentExtractionError (pdf)', async () => {
    mockGetText.mockRejectedValueOnce(new Error('corrupt PDF'));
    await expect(extractDocumentText(fakeBuffer, 'application/pdf')).rejects.toBeInstanceOf(
      DocumentExtractionError,
    );
  });

  it('applies char cap (MAX_EXTRACTED_CHARS) centrally and sets truncated=true', async () => {
    const longText = 'x'.repeat(MAX_EXTRACTED_CHARS + 100);
    mockGetText.mockResolvedValueOnce({ text: longText, total: 1 });

    const result = await extractDocumentText(fakeBuffer, 'application/pdf');
    expect(result.text.length).toBeLessThanOrEqual(MAX_EXTRACTED_CHARS);
    expect(result.truncated).toBe(true);
  });

  it('does not set truncated=true when text is within MAX_EXTRACTED_CHARS', async () => {
    const shortText = 'hello world';
    mockGetText.mockResolvedValueOnce({ text: shortText, total: 1 });

    const result = await extractDocumentText(fakeBuffer, 'application/pdf');
    expect(result.truncated).toBe(false);
    expect(result.text).toBe(shortText);
  });

  it('mammoth parser throw → DocumentExtractionError', async () => {
    mockedMammothExtract.mockRejectedValueOnce(new Error('invalid docx'));
    await expect(
      extractDocumentText(
        fakeBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).rejects.toBeInstanceOf(DocumentExtractionError);
  });
});

// ── parseCsv (RFC-4180) ───────────────────────────────────────────────────────

describe('parseCsv (RFC-4180)', () => {
  it('keeps a quoted field containing a comma as a single column', () => {
    const rows = parseCsv('name,note\n"Cafe, Lima",lunch\n');
    expect(rows).toEqual([
      ['name', 'note'],
      ['Cafe, Lima', 'lunch'],
    ]);
  });

  it('keeps a quoted field containing an embedded newline intact', () => {
    const rows = parseCsv('desc,amount\n"line one\nline two",10\n');
    expect(rows).toEqual([
      ['desc', 'amount'],
      ['line one\nline two', '10'],
    ]);
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    const rows = parseCsv('quote\n"He said ""hi"""\n');
    expect(rows).toEqual([['quote'], ['He said "hi"']]);
  });

  it('handles CRLF line endings', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('drops fully blank lines', () => {
    const rows = parseCsv('a,b\n\n1,2\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('flushes a trailing row with no final newline', () => {
    const rows = parseCsv('a,b\n1,2');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('respects MAX_TABULAR_ROWS', () => {
    const lines = Array.from({ length: MAX_TABULAR_ROWS + 50 }, (_, i) => `r${i},v`).join('\n');
    const rows = parseCsv(lines + '\n');
    expect(rows).toHaveLength(MAX_TABULAR_ROWS);
  });
});

// ── Real round-trip tests (one per format) ────────────────────────────────────

// CSV uses no library, so its round-trip runs against the mocked-module suite
// above. The remaining formats need real libraries; they live here and use
// jest.requireActual so the module mocks declared at the top do not apply.
describe('extractDocumentText real round-trip', () => {
  it('extracts text from a minimal CSV with a quoted comma (no library)', async () => {
    const csvBuf = Buffer.from('name,amount\n"Cafe, Lima",12.50\n');
    const result = await extractDocumentText(csvBuf, 'text/csv');
    expect(result.text).toContain('name | amount');
    // The embedded comma stays inside the single cell, not split into columns.
    expect(result.text).toContain('Cafe, Lima | 12.50');
    expect(result.truncated).toBe(false);
  });

  it('extracts text and page count from a real PDF fixture (pdf-parse v2)', () => {
    // pdf-parse v2 (pdfjs-dist) sets up its worker via a dynamic import that the
    // ts-jest CommonJS VM cannot run. So we run the REAL extractDocumentText in a
    // separate Node process via ts-node against the committed fixture — a genuine,
    // unmocked round-trip through the production PDF code path.
    const runner = join(__dirname, '__fixtures__', 'pdf-roundtrip-runner.ts');
    const fixture = join(__dirname, '__fixtures__', 'sample.pdf');
    const stdout = execFileSync(
      'npx',
      ['ts-node', '--compiler-options', '{"module":"commonjs"}', runner, fixture],
      { cwd: join(__dirname, '..', '..'), encoding: 'utf-8' },
    );
    const result = JSON.parse(stdout) as {
      text: string;
      pageCount: number;
      truncated: boolean;
    };

    expect(result.text).toContain('Hello PDF World');
    expect(result.pageCount).toBe(1);
    expect(result.truncated).toBe(false);
  }, 60_000);

  it('extracts a real XLSX written and read back via the xlsx lib', async () => {
    // Build a workbook in-memory, then extract it through the real code path.
    const realXlsx = jest.requireActual('xlsx');
    const ws = realXlsx.utils.aoa_to_sheet([
      ['date', 'merchant', 'amount'],
      ['2026-01-03', 'Cafe Lima', '12.50'],
    ]);
    const wb = realXlsx.utils.book_new();
    realXlsx.utils.book_append_sheet(wb, ws, 'Expenses');
    const xlsxBuf: Buffer = realXlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Route the mocked xlsx module to the real implementation for this test.
    mockedXlsxRead.mockImplementation((buf: Buffer, opts?: object) => realXlsx.read(buf, opts));
    mockedSheetToJson.mockImplementation((sheet: object, opts?: object) =>
      realXlsx.utils.sheet_to_json(sheet, opts),
    );

    const result = await extractDocumentText(
      xlsxBuf,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    expect(result.text).toContain('# Expenses');
    expect(result.text).toContain('date | merchant | amount');
    expect(result.text).toContain('2026-01-03 | Cafe Lima | 12.50');
    expect(result.truncated).toBe(false);
  });

  it('extracts DOCX text via mammoth (mock matches real { value } shape)', async () => {
    // A valid minimal .docx (zip with the right OOXML parts) is impractical to
    // hand-build in-test, so mammoth stays mocked here. The resolved object uses
    // mammoth's REAL return shape: `{ value: string; messages: unknown[] }`.
    mockedMammothExtract.mockResolvedValueOnce({
      value: 'Quarterly report body text',
      messages: [],
    });

    const result = await extractDocumentText(
      Buffer.from('fake-docx'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    expect(result.text).toContain('Quarterly report body text');
    expect(result.pageCount).toBeUndefined();
  });
});
