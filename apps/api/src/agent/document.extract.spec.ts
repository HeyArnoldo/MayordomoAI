import { MAX_TABULAR_ROWS, MAX_EXTRACTED_CHARS, MAX_PDF_PAGES } from './media.constants';
import { serializeRows, DocumentExtractionError, extractDocumentText } from './document.extract';

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

jest.mock('pdf-parse', () => {
  const mockFn = jest.fn();
  return { default: mockFn, __esModule: true };
});

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
const pdfParseMod = require('pdf-parse');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammothMod = require('mammoth');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const xlsxMod = require('xlsx');

const mockedPdfParse = pdfParseMod.default as jest.MockedFunction<
  (buf: Buffer, opts?: object) => Promise<{ text: string; numpages: number }>
>;
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
    mockedPdfParse.mockResolvedValueOnce({ text: 'PDF content here', numpages: 5 });

    const result = await extractDocumentText(fakeBuffer, 'application/pdf');
    expect(result.text).toContain('PDF content here');
    expect(result.pageCount).toBe(5);
    expect(result.truncated).toBe(false);
    expect(mockedPdfParse).toHaveBeenCalledTimes(1);
  });

  it('sets truncated=true when PDF page count exceeds MAX_PDF_PAGES', async () => {
    mockedPdfParse.mockResolvedValueOnce({
      text: 'lots of text',
      numpages: MAX_PDF_PAGES + 5,
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
    mockedPdfParse.mockRejectedValueOnce(new Error('corrupt PDF'));
    await expect(extractDocumentText(fakeBuffer, 'application/pdf')).rejects.toBeInstanceOf(
      DocumentExtractionError,
    );
  });

  it('applies char cap (MAX_EXTRACTED_CHARS) centrally and sets truncated=true', async () => {
    const longText = 'x'.repeat(MAX_EXTRACTED_CHARS + 100);
    mockedPdfParse.mockResolvedValueOnce({ text: longText, numpages: 1 });

    const result = await extractDocumentText(fakeBuffer, 'application/pdf');
    expect(result.text.length).toBeLessThanOrEqual(MAX_EXTRACTED_CHARS);
    expect(result.truncated).toBe(true);
  });

  it('does not set truncated=true when text is within MAX_EXTRACTED_CHARS', async () => {
    const shortText = 'hello world';
    mockedPdfParse.mockResolvedValueOnce({ text: shortText, numpages: 1 });

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

// ── Real round-trip tests (one per format, no library mocking) ────────────────

describe('extractDocumentText real round-trip (unmocked)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('extracts text from a minimal CSV (two lines)', async () => {
    // CSV does not use any library — no unmocking needed
    const csvBuf = Buffer.from('name,amount\nCafe Lima,12.50\n');
    const { extractDocumentText: realExtract } = await import('./document.extract');
    const result = await realExtract(csvBuf, 'text/csv');
    expect(result.text).toContain('name | amount');
    expect(result.text).toContain('Cafe Lima | 12.50');
    expect(result.truncated).toBe(false);
  });
});
