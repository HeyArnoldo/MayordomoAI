# Apply Progress: agent-document-input (PR1 + PR2 — WU-1 + WU-2)

**Branch:** `feat/document-input-channels` (stacked on `feat/document-input-foundation`)
**Batch:** PR2 (Phases 4–5 = WU-2 complete) — builds on PR1 (WU-1)
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

## Commits

### PR1 (WU-1 — foundation)

| Hash    | Subject                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------- |
| 835fb9d | docs(sdd): add agent-document-input plan (proposal, spec, design, tasks)                          |
| 51322df | feat(contracts): mediaItem discriminated union, document_rejected code, doc constants and i18n    |
| d224547 | feat(agent): document text extraction module (PDF, DOCX, CSV, XLSX) with TDD                      |
| 2bf4b31 | feat(agent): document validation, isLowText helper, and generalize strip to stripMediaFromHistory |

### PR2 (WU-2 — channel wiring)

| Hash    | Subject                                                                |
| ------- | ---------------------------------------------------------------------- |
| 7348517 | feat(chat): document branch on POST /chat (extract + inject + persist) |
| 3af7cf1 | feat(whatsapp): handle inbound document messages                       |
| 4518b6e | feat(web): allow document attachments in composer                      |

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

### PR1 gates

| Gate                                      | Result                                          |
| ----------------------------------------- | ----------------------------------------------- |
| `pnpm install --frozen-lockfile`          | PASS                                            |
| `pnpm --filter "./packages/**" run build` | PASS                                            |
| `pnpm lint`                               | PASS (0 errors, pre-existing warnings only)     |
| `pnpm typecheck` (ROOT)                   | PASS (no TS1360, no discriminated-union errors) |
| `pnpm build`                              | PASS                                            |
| `pnpm test`                               | PASS — 243 tests, 21 suites                     |

### PR2 gates (branch: feat/document-input-channels)

| Gate                                      | Result                                        |
| ----------------------------------------- | --------------------------------------------- |
| `pnpm install --frozen-lockfile`          | PASS                                          |
| `pnpm --filter "./packages/**" run build` | PASS                                          |
| `pnpm lint`                               | PASS (0 errors, 4 pre-existing warnings only) |
| `pnpm typecheck` (ROOT)                   | PASS                                          |
| `pnpm build`                              | PASS (web build in 25s)                       |
| `pnpm test`                               | PASS — 275 tests, 21 suites                   |

---

## Test Count

### PR1

- **Total API tests:** 243 (21 suites, after judgment-day fixes)
- **New tests in PR1:**
  - `document.extract.spec.ts`: 23 tests + 10 post-review fixes (parseCsv × 7, real PDF/XLSX/DOCX round-trips)
  - `media.helpers.spec.ts` additions: 29 tests (validateDocument × 12, isLowText × 7, stripMediaFromHistory × 10)
  - Total new in PR1: ~52 tests

### PR2

- **Total API tests:** 275 (21 suites)
- **New tests in PR2:**
  - `chat.controller.spec.ts` additions: 19 document branch tests
  - `whatsapp.service.spec.ts` additions: 15 handleDocument tests
  - Total new in PR2: 34 tests
- **Cumulative new tests (PR1 + PR2):** ~86 tests

---

## Phase 4 — Channel Wiring (WU-2, PR2)

- [x] 4.1 RED: `chat.controller.spec.ts` — 19 new document branch tests (validate, extract, inject, persist, reject paths, mixed turn, strip)
- [x] 4.2 GREEN: `chat.controller.ts` — document branch: MIME branching (image/\* vs doc/other), validateDocument, extractDocumentText, isLowText, inject extracted text into model turn, persist caption/placeholder + mediaContext only. Replace `stripImagesFromHistory` → `stripMediaFromHistory`.
- [x] 4.3 RED: `whatsapp.service.spec.ts` — 15 new handleDocument tests (happy path, getBase64 null/throw, oversize, low-text, extract error, AI disabled, caption/no-caption)
- [x] 4.4 GREEN: `whatsapp.service.ts` — `documentMessage` type extension + `handleDocument` method; dispatch branch in `processInbound` before `!text` fallback.
- [x] 4.5 `apps/web/src/features/chat/chat-thread.tsx` — accept list extended with PDF/DOCX/CSV/XLSX; maxFileSize raised to 8 MB (MAX_DOCUMENT_BYTES); comment documents per-type server cap.

## Phase 5 — Integration & Gates (WU-2, PR2)

- [x] 5.1 ROOT CI gates — all PASS (see results below)
- [ ] 5.2 Manual smoke — Web channel (pending post-merge with running Postgres+API)
- [ ] 5.3 Manual smoke — WhatsApp channel (pending with Evolution instance)
- [ ] 5.4 Verify history strip round-trip (manual)

---

## Judgment-Day Fixes (post-PR2 fresh review)

**Branch:** `feat/document-input-channels` — no push, no PR.
**Commits:** `3bc6739`, `7b15b31`

### Tests added (Fix 1 + Fix 2)

| File                       | New test                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `whatsapp.service.spec.ts` | Unsupported MIME (`application/zip`) → `documentNotUnderstood`, `agent.run` NOT called                   |
| `whatsapp.service.spec.ts` | Strengthen success test: extracted body (`EXTRACTED_DOC_BODY`) must appear in text passed to `agent.run` |
| `chat.controller.spec.ts`  | Valid PDF upload: extracted text in current-turn model message, no `file` part remains                   |

### Refactor (Fix 3)

- `apps/api/src/chat/chat.controller.ts` (~262-275): collapsed `if (err instanceof DocumentExtractionError)` + duplicate fallback into single `catch` block. Removed now-unused `DocumentExtractionError` import.
- `apps/api/src/whatsapp/whatsapp.service.ts` (~304-315): collapsed identical `DocumentExtractionError`-branch + fallback into single `catch` block. Removed now-unused `DocumentExtractionError` import.

### Gate results (judgment-day run)

| Gate                                      | Result                                      |
| ----------------------------------------- | ------------------------------------------- |
| `pnpm --filter "./packages/**" run build` | PASS                                        |
| `pnpm lint`                               | PASS (0 errors, pre-existing warnings only) |
| `pnpm typecheck` (ROOT)                   | PASS                                        |
| `pnpm test` (ROOT)                        | PASS — **277 tests**, 21 suites (+2 vs PR2) |

---

## Manual Verification Steps (Phase 5.2 / 5.3 / 5.4)

### Web channel (5.2) — requires running API + Postgres

1. Open the chat web UI.
2. Click the attachment (paperclip) button — confirm the file picker shows PDF, DOCX, CSV, XLSX MIME options.
3. Attach a text-native PDF ≤ 8 MB + type a caption → send. Verify agent replies with a document summary.
4. Attach a DOCX file → agent reads body text and replies.
5. Attach a CSV file → agent can answer questions about the data rows.
6. Attach an XLSX file → agent can read the first sheet's rows.
7. Attach a file > 8 MB → toast shows the `chat.document_rejected` localized error message.
8. Attach a scanned/image-only PDF (no selectable text) → toast shows the `chat.document_rejected` error.
9. Attach an image AND a document in the same message → toast shows `chat.document_rejected` (mixed not allowed).

### WhatsApp channel (5.3) — requires Evolution API + real WhatsApp number

1. Send a PDF document message with a caption → agent replies with a document summary in WhatsApp.
2. Send an oversize document (> 8 MB) → receive `documentTooLarge` WhatsApp reply.
3. Send a scanned PDF (image-only) → receive `documentNoText` WhatsApp reply.
4. Simulate getBase64 failure (e.g. disconnect Evolution, then send) → receive `documentNotUnderstood` reply.

### History strip (5.4)

1. Send a document via the web UI → agent replies.
2. Send a follow-up text message in the same conversation.
3. Check that the model does NOT receive the previously extracted document text in the history (only `[document: <filename>]` placeholder).
4. Run `pnpm typecheck` after all changes — should still be green.

---

## Risks / Deviations (PR1 + PR2)

- `@types/mammoth` is not in the npm registry (404). mammoth ships its own TypeScript declarations in the package — no external `@types` needed. Verified: `tsc --noEmit` passes without it.
- `stripImagesFromHistory` import site updated in PR2 (`chat.controller.ts` now imports `stripMediaFromHistory` directly). The deprecated alias in `media.helpers.ts` can be removed in a cleanup PR.
- XLSX was included (not deferred to Slice 2b) — budget was acceptable since dispatcher tests use mocks (no real XLSX library overhead in test suite).
- **Evolution `documentMessage` envelope assumed**: The `documentMessage` type (`{ caption, mimetype, fileName }`) is based on Evolution API documentation and field naming conventions (mirroring `imageMessage`). The real envelope must be verified against an actual Evolution webhook payload before merging to production.
- **@ai-sdk/react file-part shape for documents**: Documents arrive via the same `file` part mechanism as images (data-URL with MIME type). The controller branches on `image/*` prefix to separate image vs document parts. If AI-SDK adds a dedicated document part type in a future version, the branching logic should be updated.
- **Mixed image+document** rejected by design (single-medium-per-turn for v1 simplicity). This is a known limitation documented in design §5.2.

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
