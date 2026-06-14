# Tasks: Agent Document Input (Slice 2 — PDF / DOCX / CSV / XLSX)

## Review Workload Forecast

| Field                   | Value                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| Estimated changed lines | 550–750 (production) + 350–450 (tests) ≈ 900–1 200 total          |
| 400-line budget risk    | High                                                              |
| Chained PRs recommended | Yes                                                               |
| Suggested split         | PR 1 (foundation + extraction core) → PR 2 (channel wiring + web) |
| Delivery strategy       | ask-on-risk                                                       |
| Chain strategy          | pending (decision needed before apply)                            |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

> **XLSX deferral option (Slice 2b):** `extractXlsx` + its tests account for ~80–120 lines. Deferring XLSX to Slice 2b is proposal-sanctioned and would bring PR 1 closer to budget. Mark task 2.4 optional if the team chooses to defer.

### Suggested Work Units

| Unit | Goal                                                                              | Likely PR | Notes                                                |
| ---- | --------------------------------------------------------------------------------- | --------- | ---------------------------------------------------- |
| WU-1 | Foundation: contracts, constants, i18n, extraction module, pure helpers           | PR 1      | Base = feature branch; all TDD targets 1–6 green     |
| WU-2 | Channel wiring: chat controller doc branch, WhatsApp handleDocument, web composer | PR 2      | Base = PR 1 branch; TDD targets 7–8 green; E2E smoke |

---

## Phase 1: Foundation (contracts, constants, i18n) — WU-1 start

> **Atomic gate:** tasks 1.1 + 1.2 + 1.3 MUST land in one commit. Adding `chat.document_rejected`
> to `error-codes.ts` without its EN + ES translations causes `pnpm typecheck` (ROOT) to fail
> with TS1360. Run `pnpm typecheck` as the gate for this group, not per-package.

- [x] 1.1 `packages/contracts/src/error-codes.ts` — add `'chat.document_rejected'` to `ERROR_CODES` array (after `'chat.image_rejected'`).
  - TDD: N/A (compile-time gate); gate = `pnpm typecheck` (ROOT).

- [x] 1.2 `packages/i18n/src/locales/es/errors.ts` — add `chat.document_rejected` key under `chat:` block.
  - Value: `'No se pudo leer el documento. Revisa el tipo de archivo, el tamaño o que contenga texto seleccionable.'`
  - TDD: N/A; gate = `pnpm typecheck` (ROOT, TS1360 assertion on last line).

- [x] 1.3 `packages/i18n/src/locales/en/errors.ts` — add `chat.document_rejected` key under `chat:` block (satisfies `typeof es.errors` shape).
  - Value: `'The document could not be read. Check the file type, size, or that it contains selectable text.'`
  - Gate = `pnpm typecheck` (ROOT).

- [x] 1.4 `packages/i18n/src/locales/es/api.ts` + `en/api.ts` — add three WhatsApp fallback keys under `whatsapp:`: `documentNotUnderstood`, `documentTooLarge`, `documentNoText`.
  - ES values: `'No pude procesar ese documento. ¿Puedes intentarlo de nuevo?'` / `'Ese documento supera el límite de 8 MB.'` / `'No pude leer texto en ese documento. El PDF parece ser escaneado — el reconocimiento óptico aún no está disponible.'`
  - EN: professional equivalents.
  - Gate = `pnpm typecheck` (ROOT).

- [x] 1.5 `packages/contracts/src/chat.ts` — refactor `mediaItemSchema` into discriminated union: `imageMediaItemSchema` (literal `'image'`) + `documentMediaItemSchema` (literal `'document'`, optional `pageCount`). Export updated `MediaItem` type. Keep `messageSchema.mediaContext` as `z.array(mediaItemSchema).nullable().optional()`.
  - TDD: non-TDD (schema); verify with `pnpm --filter @app/contracts run build` and `pnpm typecheck` (ROOT).

- [x] 1.6 `apps/api/src/agent/media.constants.ts` — add document caps and allowlist constants:
      `MAX_DOCUMENTS = 1`, `MAX_DOCUMENT_BYTES = 8 * 1024 * 1024`, `MAX_PDF_PAGES = 30`,
      `MAX_EXTRACTED_CHARS = 40_000`, `MIN_EXTRACTED_CHARS = 20`, `MAX_TABULAR_ROWS = 500`,
      `DOCUMENT_MIME_ALLOWLIST` array.
  - TDD: N/A (constants); verified indirectly by Phase 2 tests.

---

## Phase 2: Extraction Module (TDD-first) — WU-1 core

All tasks in this phase follow RED → GREEN order. Write the failing spec first, then the implementation.

- [x] 2.1 **RED** `apps/api/src/agent/document.extract.spec.ts` — tests for `serializeRows`:
  - pipe-delimited output, sheet-name prefix for XLSX blocks, empty cells → empty string,
    row cap truncation notice (`MAX_TABULAR_ROWS`), trailing all-empty column trimming.
  - Test command: `pnpm --filter @app/api run test -- --testPathPattern=document.extract`.

- [x] 2.2 **GREEN** `apps/api/src/agent/document.extract.ts` — implement `serializeRows(sheetName, rows: string[][]): string`.

- [x] 2.3 **RED** `document.extract.spec.ts` — tests for per-format extractors (mocked libraries):
  - `extractPdf`: page-cap truncation (`MAX_PDF_PAGES`), `pageCount` populated from `data.numpages`, `truncated` flag.
  - `extractDocx`: returns raw text from `mammoth.extractRawText`.
  - `extractCsv`: native split feeds `serializeRows` correctly; two-line CSV fixture inline.
  - Dispatcher `extractDocumentText`: routes by mime to correct extractor (extractors mocked), unknown mime → throws `DocumentExtractionError`, parser throw → `DocumentExtractionError`, char-cap applied centrally at `MAX_EXTRACTED_CHARS`, `truncated` set.

- [x] 2.4 **GREEN** `document.extract.ts` — implement `DocumentExtractionError`, `extractPdf`, `extractDocx`, `extractCsv`, `extractDocumentText` dispatcher.
  - Deps installed: `pdf-parse`, `@types/pdf-parse`, `mammoth`, `xlsx`. No `@types/mammoth` (not in registry). Lockfile committed.
  - `allowBuilds` NOT changed — no new native build scripts needed.
  - **XLSX included (not deferred):** `extractXlsx` implemented and tested via mock + serializeRows.

- [x] 2.4b XLSX included in 2.4 — `extractXlsx` implemented in `document.extract.ts` and tested (mocked) in spec.

---

## Phase 3: Pure Helpers (TDD-first) — WU-1 completion

- [x] 3.1 **RED** `apps/api/src/agent/media.helpers.spec.ts` — add tests for `validateDocument`:
  - mime ∈ `DOCUMENT_MIME_ALLOWLIST` accepted; unsupported mime throws.
  - `url.startsWith('data:')` enforced; missing prefix throws.
  - `base64Bytes` size ≤ `MAX_DOCUMENT_BYTES` passes; size > cap throws.
  - Returns correct `MediaItem` shape (`type: 'document'`, mediaType, filename, size; no pageCount yet).
  - WhatsApp-style (size provided directly) supported.

- [x] 3.2 **GREEN** `apps/api/src/agent/media.helpers.ts` — implement `validateDocument(part): MediaItem`.

- [x] 3.3 **RED** `media.helpers.spec.ts` — add tests for `isLowText`:
  - `text.trim().length < MIN_EXTRACTED_CHARS` → true; boundary values; whitespace-only → true.

- [x] 3.4 **GREEN** `media.helpers.ts` — implement `isLowText(text: string): boolean`.

- [x] 3.5 **RED** `media.helpers.spec.ts` — add tests for `stripMediaFromHistory` (replacing `stripImagesFromHistory`):
  - image file parts → `[image: <label>]` placeholder (existing behavior preserved).
  - document file parts (mime matches `/pdf|word|sheet|csv/i`) → `[document: <label>]` placeholder.
  - Mixed image + document history: both replaced with correct labels.
  - Last user message left intact.
  - No-file-parts message returns same reference (no mutation).

- [x] 3.6 **GREEN** `media.helpers.ts` — added `stripMediaFromHistory` with improved label logic; `stripImagesFromHistory` kept as deprecated alias pointing to it. Import site update deferred to PR2 (WU-2) to keep this PR focused on foundation only.

---

## Phase 4: Channel Wiring — WU-2

- [x] 4.1 **RED** `apps/api/src/chat/chat.controller.spec.ts` — add tests for document branch:
  - validate → extract → inject: `mediaContext` contains `type: 'document'` metadata; no extracted text in persisted content; content = caption or `[document: <name>]` placeholder.
  - Reject path: extraction throws → `AppException('chat.document_rejected', 400)`.
  - Low-text path: `isLowText` returns true → `AppException('chat.document_rejected', 400)`.
  - Count > `MAX_DOCUMENTS` → reject.
  - Mixed image+document → reject documents path (document rejected, image processed).

- [x] 4.2 **GREEN** `apps/api/src/chat/chat.controller.ts` — in the `if (last?.role === 'user')` file-parts block, add document branch:
  1. Collect `file` parts by mime: images vs documents.
  2. Validate document parts via `validateDocument`; wrap errors in `AppException('chat.document_rejected', 400)`.
  3. Decode base64 buffer from data URL.
  4. Call `extractDocumentText(buffer, mime)`; catch `DocumentExtractionError` → `AppException`.
  5. Call `isLowText(result.text)` → `AppException` if true.
  6. Set `mediaContext` item (`type: 'document'`, pageCount from `result.pageCount`, size, filename).
  7. Replace file part with text part `Document: <filename>\n\n<extractedText>` + optional truncation notice part.
  8. Persist: `content` = caption or `[document: <filename>]`, `mediaContext` = metadata only.
  9. Call `stripMediaFromHistory` (updated name) before passing history to `AgentService.run`.

- [x] 4.3 **RED** `apps/api/src/whatsapp/whatsapp.service.spec.ts` — add tests for `handleDocument`:
  - Happy path: `getBase64` → buffer → validate → extract → run agent → reply sent.
  - `getBase64` returns null → `documentNotUnderstood` reply, no agent call.
  - `getBase64` throws → `documentNotUnderstood` reply, logged.
  - Size > `MAX_DOCUMENT_BYTES` → `documentTooLarge` reply.
  - Low-text → `documentNoText` reply, no agent call.
  - AI disabled → `aiDisabled` reply (existing path).
  - Spec ref: WhatsApp Document Receive scenarios.

- [x] 4.4 **GREEN** `apps/api/src/whatsapp/whatsapp.service.ts` — add `documentMessage` payload type extension and `handleDocument(...)` method mirroring `handleImage`:
  1. `getBase64(messageId)` in try/catch.
  2. `Buffer.from(base64, 'base64')`.
  3. `validateDocument({ mediaType: mimetype, size: buffer.length, filename })`.
  4. `extractDocumentText(buffer, mimetype)`.
  5. `isLowText` check → `documentNoText` fallback.
  6. Persist user turn: `content = caption || '[document: <filename>]'`, `mediaContext`.
  7. Build model turn: `[text(extracted + notice?), text(caption?)]` (text-only, no ImagePart).
  8. `stripMediaFromHistory` on history before agent run.
  9. In `processInbound`: add `if (data?.message?.documentMessage)` branch before the `!text` fallback.

- [x] 4.5 `apps/web/src/features/chat/chat-thread.tsx` — extend `accept` with document MIME types (PDF/DOCX/CSV/XLSX); set `maxFileSize` to `MAX_DOCUMENT_BYTES` (8 MB); add inline comment explaining server enforces per-type cap (images 4 MB, docs 8 MB).
  - TDD: N/A (UI hint); manual smoke test per 4.6.

---

## Phase 5: Integration & Gates

- [x] 5.1 ROOT CI gates — run in order and fix any failures before PR:
  1. `pnpm install --frozen-lockfile` (lockfile must match after new deps).
  2. `pnpm --filter "./packages/**" run build` (contracts + i18n rebuilt).
  3. `pnpm lint`.
  4. `pnpm typecheck` (ROOT — includes TS1360 gate and discriminated-union narrowing).
  5. `pnpm build`.
  6. `pnpm test` (runs all jest suites including `pnpm --filter @app/api run test`).

- [ ] 5.2 Manual smoke — Web channel:
  - PDF ≤8 MB + caption → agent replies with summary.
  - DOCX → agent reads body text.
  - CSV → agent reads serialized rows.
  - XLSX (if not deferred) → agent reads first sheet.
  - > 8 MB file → toast error with `chat.document_rejected` message.
  - Scanned PDF (image-only) → toast "no selectable text" message.

- [ ] 5.3 Manual smoke — WhatsApp channel:
  - PDF `documentMessage` with caption → agent reply in WhatsApp.
  - Oversize document → `documentTooLarge` WhatsApp reply.
  - Scanned PDF → `documentNoText` WhatsApp reply.
  - `getBase64` failure simulation → `documentNotUnderstood` WhatsApp reply.

- [ ] 5.4 Verify history strip: send a document, then send a follow-up text message. Confirm the second turn's history does NOT include document extracted text (only `[document: <name>]` placeholder). Verify `pnpm typecheck` still green after discriminated-union exhaustive switch.
