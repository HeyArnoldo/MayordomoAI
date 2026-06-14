# Apply Progress: agent-document-input (PR1 — WU-1)

**Branch:** `feat/document-input-foundation`
**Batch:** PR1 (Phases 1–3 = WU-1 complete)
**Status:** done — all ROOT gates pass

---

## Completed Tasks

### Phase 1 — Foundation (all in one atomic commit)

- [x] 1.1 `chat.document_rejected` added to `packages/contracts/src/error-codes.ts`
- [x] 1.2 ES translation added to `packages/i18n/src/locales/es/errors.ts`
- [x] 1.3 EN translation added to `packages/i18n/src/locales/en/errors.ts`
- [x] 1.4 WhatsApp fallback keys (`documentNotUnderstood`, `documentTooLarge`, `documentNoText`) added to both `es/api.ts` and `en/api.ts`
- [x] 1.5 `mediaItemSchema` refactored to discriminated union (`imageMediaItemSchema` | `documentMediaItemSchema`) in `packages/contracts/src/chat.ts`
- [x] 1.6 Document constants added to `apps/api/src/agent/media.constants.ts`

### Phase 2 — Extraction Module (TDD RED→GREEN)

- [x] 2.1 RED tests written: `serializeRows` (8 tests)
- [x] 2.2 GREEN: `serializeRows` implemented in `apps/api/src/agent/document.extract.ts`
- [x] 2.3 RED tests written: dispatcher + per-format extractors (mocked) (15 tests)
- [x] 2.4 GREEN: `DocumentExtractionError`, `extractPdf`, `extractDocx`, `extractCsv`, `extractXlsx`, `extractDocumentText` dispatcher — all implemented
- [x] 2.4b XLSX included (not deferred): `extractXlsx` via SheetJS, mocked in tests
- Real round-trip test: 1 CSV round-trip (no library mock needed)

### Phase 3 — Pure Helpers (TDD RED→GREEN)

- [x] 3.1 RED: `validateDocument` tests (12 tests covering allowlist, URL, size, WhatsApp-style)
- [x] 3.2 GREEN: `validateDocument` implemented in `apps/api/src/agent/media.helpers.ts`
- [x] 3.3 RED: `isLowText` tests (7 tests)
- [x] 3.4 GREEN: `isLowText` implemented
- [x] 3.5 RED: `stripMediaFromHistory` tests (10 tests covering image/doc/mixed/last-user/no-mutation)
- [x] 3.6 GREEN: `stripMediaFromHistory` added; `stripImagesFromHistory` kept as deprecated alias. Import site update deferred to PR2 (controller change is PR2 scope).

---

## Commits (PR1)

| Hash    | Subject                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------- |
| 835fb9d | docs(sdd): add agent-document-input plan (proposal, spec, design, tasks)                          |
| 51322df | feat(contracts): mediaItem discriminated union, document_rejected code, doc constants and i18n    |
| d224547 | feat(agent): document text extraction module (PDF, DOCX, CSV, XLSX) with TDD                      |
| 2bf4b31 | feat(agent): document validation, isLowText helper, and generalize strip to stripMediaFromHistory |

---

## Dependencies Added

| Package          | Version | Type          | allowBuilds changed? |
| ---------------- | ------- | ------------- | -------------------- |
| pdf-parse        | ^2.4.5  | production    | No                   |
| mammoth          | ^1.12.0 | production    | No                   |
| xlsx             | ^0.18.5 | production    | No                   |
| @types/pdf-parse | ^1.1.5  | devDependency | No                   |

No `allowBuilds` changes needed — none of the new deps require native build scripts.

---

## ROOT Gate Results

| Gate                                      | Result                                          |
| ----------------------------------------- | ----------------------------------------------- |
| `pnpm install --frozen-lockfile`          | PASS                                            |
| `pnpm --filter "./packages/**" run build` | PASS                                            |
| `pnpm lint`                               | PASS (0 errors, pre-existing warnings only)     |
| `pnpm typecheck` (ROOT)                   | PASS (no TS1360, no discriminated-union errors) |
| `pnpm build`                              | PASS                                            |
| `pnpm test`                               | PASS — 233 tests, 21 suites                     |

---

## Test Count

- **Total API tests:** 233 (21 suites)
- **New tests in this PR:**
  - `document.extract.spec.ts`: 23 tests (serializeRows × 8, DocumentExtractionError × 4, dispatcher × 10, real CSV round-trip × 1)
  - `media.helpers.spec.ts` additions: 29 tests (validateDocument × 12, isLowText × 7, stripMediaFromHistory × 10)
  - Total new: 52 tests

---

## What Remains for PR2 (WU-2)

- [ ] 4.1 RED: `chat.controller.spec.ts` — document branch tests
- [ ] 4.2 GREEN: `chat.controller.ts` — document branch (validate → extract → inject → persist)
- [ ] 4.3 RED: `whatsapp.service.spec.ts` — `handleDocument` tests
- [ ] 4.4 GREEN: `whatsapp.service.ts` — `handleDocument` + `documentMessage` dispatch
- [ ] 4.5 `apps/web/.../chat-thread.tsx` (or `chat.tsx`) — accept doc MIME types + maxFileSize update
- Update `stripImagesFromHistory` import to `stripMediaFromHistory` in `chat.controller.ts`
- Phases 5 (integration gates, manual smoke) apply to PR2 post-merge

---

## Risks / Deviations

- `@types/mammoth` is not in the npm registry (404). mammoth ships its own TypeScript declarations in the package — no external `@types` needed. Verified: `tsc --noEmit` passes without it.
- `stripImagesFromHistory` import site (`chat.controller.ts`) NOT updated in PR1 to keep this branch minimal. The alias ensures backward compatibility until PR2 updates it.
- XLSX was included (not deferred to Slice 2b) — budget was acceptable since dispatcher tests use mocks (no real XLSX library overhead in test suite).

---

## Post-review surgical fixes (judgment-day)

Fresh-review findings fixed on this branch:

- **B1 (BLOCKER) — pdf-parse v2 API mismatch.** `extractPdf` was written for pdf-parse v1
  (callable default, `{max}` option, `{text, numpages}` result) but the installed runtime is
  v2.4.5, which exports a `PDFParse` CLASS. Rewrote `extractPdf` to the real v2 API:
  `const { PDFParse } = require('pdf-parse'); const parser = new PDFParse({ data: buffer });
const res = await parser.getText({ first: MAX_PDF_PAGES }); /* res.text, res.total */`
  with `await parser.destroy()` in a `finally`. `pageCount` now reads `res.total`; truncation
  is flagged when `res.total > MAX_PDF_PAGES`. Removed devDependency `@types/pdf-parse@^1.1.5`
  (v1 type package paired with a v2 runtime; v2 ships its own types). Lockfile updated.
- **S1 (SHOULD-FIX) — real round-trip tests.** Fixed the pdf-parse mock to the real v2 shape
  (`PDFParse` class, `getText`→`{text,total}`, `destroy`). Added a committed minimal PDF fixture
  (`src/agent/__fixtures__/sample.pdf`, text "Hello PDF World") and a genuine unmocked PDF
  round-trip. pdf-parse v2 (pdfjs-dist) sets up its worker via a dynamic `import()` the ts-jest
  CommonJS VM cannot run, so the PDF round-trip runs the REAL `extractDocumentText` in a separate
  Node process via ts-node (`src/agent/__fixtures__/pdf-roundtrip-runner.ts`), invoked with
  `execFileSync`. Added a real XLSX write-then-read round-trip (in-memory workbook via the real
  `xlsx` lib). DOCX stays mocked (a valid minimal .docx is impractical in-test) with a comment;
  the mock matches mammoth's real `{ value, messages }` shape.
- **S2 (SHOULD-FIX) — RFC-4180 CSV parsing.** Replaced naive `split(',')` with a correct
  `parseCsv` (exported) handling quoted commas, embedded newlines, and escaped quotes (`""`),
  accepting `\n` and `\r\n`, dropping blank lines, and capping at `MAX_TABULAR_ROWS`. Added
  unit tests for each case.
- **N2 (NITPICK) — image placeholder.** Restored the image-variant fallback in
  `media.helpers.ts` `stripMediaFromHistory`: image-only output is byte-identical to the old
  `stripImagesFromHistory` (`[image: image]` when no filename/mediaType); documents fall back
  to `[document: document]`.

### Discovery (test-environment, not a production bug)

pdf-parse v2 cannot execute inside the ts-jest CommonJS VM (pdfjs-dist requires
`--experimental-vm-modules` for its worker's dynamic import). Production Node runs it fine
(verified via direct `node` and ts-node). Hence the out-of-process round-trip runner instead of
switching the whole Jest config to ESM.

### Gates (ROOT, all pass)

`pnpm install --frozen-lockfile`, `pnpm --filter "./packages/**" run build`, `pnpm lint`
(0 errors), `pnpm typecheck`, `pnpm build`, `pnpm test` — **243 tests pass** (was 233-ish before
these additions; +10 new tests: 7 parseCsv, 1 real PDF round-trip, 1 real XLSX round-trip, 1 DOCX).
