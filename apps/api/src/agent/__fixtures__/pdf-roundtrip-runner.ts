/**
 * Out-of-process PDF round-trip runner.
 *
 * pdf-parse v2 relies on pdfjs-dist, which sets up its worker via a dynamic
 * `import()`. The ts-jest CommonJS VM cannot perform that import (it requires
 * `--experimental-vm-modules`), so the real PDF code path cannot execute inside
 * the Jest worker. This script runs the REAL `extractDocumentText` in a plain
 * Node process (spawned by the spec via ts-node) so the PDF round-trip is
 * genuinely exercised against the committed fixture, not mocked.
 *
 * Usage: ts-node pdf-roundtrip-runner.ts <absolute-path-to-pdf>
 * Output: JSON `{ text, pageCount, truncated }` on stdout.
 */
import { readFileSync } from 'node:fs';
import { extractDocumentText } from '../document.extract';

async function main(): Promise<void> {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    throw new Error('Missing PDF path argument');
  }
  const buffer = readFileSync(pdfPath);
  const result = await extractDocumentText(buffer, 'application/pdf');
  process.stdout.write(
    JSON.stringify({
      text: result.text,
      pageCount: result.pageCount,
      truncated: result.truncated,
    }),
  );
}

main().catch((err: unknown) => {
  process.stderr.write(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
