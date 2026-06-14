# Proposal: Agent Document Input (Slice 2 — PDF / DOCX / CSV / XLSX)

## Intent

The mayordomo is a personal-finance butler. Slice 1 shipped image understanding;
the next friction point is **documents**. Users hold a **bank statement PDF**, an
**expense spreadsheet**, or a **Word doc** — and today must retype each line. We
want to send a document and have the finance agent **read it** (amounts, dates,
merchants), summarize it, and help register transactions. This lands on **both
web and WhatsApp** with the same channel-parity contract as Slice 1.

## Scope

### In Scope (Slice 2 — shippable)

- **Server-side text extraction → inject as a text part** into the agent turn
  (no vision tokens, model-agnostic). Formats IN: **PDF (text), DOCX, CSV, XLSX**.
- Reuse `mediaContext` metadata: extend `MediaItem.type` to include `'document'`
  (filename/size/mime; optional `pageCount`). **Never persist the binary.**
- **Web**: composer accepts document MIME types (multipart/data-URL file part),
  alongside existing image attach.
- **WhatsApp**: add `documentMessage` branch mirroring the `imageMessage` path
  (`getBase64()` + mimetype + caption).
- Guardrails: max file size, max PDF pages, max extracted-char cap (token budget);
  reject/truncate with a clear localized message.
- **Empty/low-text detection** (scanned/image-only PDF) → inform user it can't be
  read as text (OCR is a future slice).
- New error code `chat.document_rejected` + EN/ES translations.

### Out of Scope (non-goals)

- OCR / scanned (image-only) PDFs → future Slice 3 (pages→vision).
- Object/file storage (S3/MinIO/local) — documents are **ephemeral**.
- Document history replay of extracted text or binaries (strip on replay, like images).
- Images/charts embedded inside documents; rich layout/table fidelity.
- Auto-creating transactions without user confirmation (reuse existing register flow).

## Capabilities

### New Capabilities

- `document-input`: receiving documents (PDF/DOCX/CSV/XLSX) across web and
  WhatsApp, extracting text server-side, injecting as model text, with guardrails
  (size/pages/char-cap), empty-text handling, and channel parity.

### Modified Capabilities

- `multimodal-input`: `MediaItem.type` gains `'document'`; channel branches and
  history-strip logic extended to documents.
- `agent-chat`: user turns may carry extracted-document text + document
  `mediaContext`; replayed history strips document text/binaries.

## Approach

**D1: extract-then-inject.** On the server, decode the file in-memory, extract
plain text (`pdf-parse`, `mammoth`, `xlsx`/`papaparse`), and pass it to the agent
as a `text` part labeled with filename — NOT a native AI-SDK file part (unlike
images). This is cheap, model-agnostic, and reuses the existing free-form +
user-confirmed register flow (no new `analyzeDocument` tool, consistent with
Slice 1). A document + caption/prompt combine as: extracted-text part first, then
the user's caption/prompt as a second text part.

## Affected Areas

| Area                                          | Impact       | Description                                                  |
| --------------------------------------------- | ------------ | ------------------------------------------------------------ |
| `apps/api/src/agent/media.constants.ts`       | Modified     | Doc size/page/char caps, `DOCUMENT_MIME_ALLOWLIST`           |
| `apps/api/src/agent/media.helpers.ts`         | New/Modified | `extractDocumentText`, `validateDocumentParts`, extend strip |
| `apps/api/src/agent/document.extract.ts`      | New          | Per-format extractors (pdf/docx/xlsx/csv)                    |
| `packages/contracts/src/chat.ts`              | Modified     | `mediaItemSchema` union: add `'document'`                    |
| `packages/contracts/src/error-codes.ts`       | Modified     | `chat.document_rejected`                                     |
| `packages/i18n/src/locales/{en,es}/errors.ts` | Modified     | translation (TS1360 gate)                                    |
| `apps/api/src/chat/chat.controller.ts`        | Modified     | Validate + extract doc parts                                 |
| `apps/api/src/whatsapp/whatsapp.service.ts`   | Modified     | `documentMessage` branch + payload type                      |
| `apps/web/.../chat/chat-thread.tsx`           | Modified     | Accept doc MIME types in composer                            |

## Risks

| Risk                                            | Likelihood | Mitigation                                                              |
| ----------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| Malformed/zip-bomb doc crashes parser           | Med        | Hard size cap before parse; try/catch → reject; bound output chars      |
| Memory pressure under Coolify (in-memory parse) | Med        | Strict size cap; parse one doc/turn; release buffers                    |
| Scanned PDF yields empty/garbage text           | High       | Low-text detection → friendly "can't read as text" message              |
| Extracted text blows token budget               | High       | Char-cap + truncation notice in prompt                                  |
| XLSX (`xlsx`) adds disproportionate complexity  | Med        | Keep IN with a thin row→text serializer; if it slips, defer to Slice 2b |

## Rollback Plan

Feature-branch only (`main` auto-deploys to Coolify). Revert the branch; the
`'document'` union member and new error code are additive — `mediaContext` column
is unchanged (no migration needed). Web composer reverts to image-only `accept`.

## Dependencies

- npm (Node, no native deps): `pdf-parse`, `mammoth`, `xlsx` (or `exceljs`),
  `papaparse` (CSV). Reuse Evolution `getBase64()` (already used for audio/image).

## Assumptions (AUTOMATIC mode — chosen defaults)

- Formats **IN**: PDF (text), DOCX, CSV, XLSX. **OUT**: scanned/image-only PDF (OCR).
- **Caps**: max **1 document/message**, **~8 MB**, **PDF ≤ 30 pages**, extracted
  text **≤ ~40k chars** (truncate with notice). Oversize/too-many-pages → reject.
- **Empty-text** (after extraction) → inform user, do not call the model.
- Document → **text injection** (not native file part); free-form response +
  existing user-confirmed register flow (no new structured tool).
- Documents are **ephemeral**: only `mediaContext` metadata persisted, never binary
  nor extracted text in history replay.
- Reply **language follows conversation locale** (existing i18n).
- WhatsApp **caption** becomes the accompanying text/prompt part.

## Proposal Question Round (needs user review — answer or accept defaults)

1. **Caps**: are 1 doc/msg, 8 MB, 30 pages, 40k chars acceptable, or different?
2. **XLSX**: keep IN this slice, or defer to Slice 2b to de-risk the budget?
3. **CSV/XLSX shape**: serialize as plain rows (markdown-ish table) — acceptable,
   or do you want column-aware summarization left entirely to the agent?
4. **Empty/scanned PDF**: message-and-stop (default) vs. attempt partial text?
5. **Persistence**: confirm extracted text is NEVER stored (only `mediaContext`).

## Success Criteria

- [ ] User sends a statement PDF on web → agent extracts amounts/dates and offers to register.
- [ ] Same on WhatsApp via `documentMessage` (channel parity).
- [ ] CSV and XLSX rows are read and summarized; DOCX text is read.
- [ ] Oversize / too-many-pages / empty-text rejected gracefully in both channels.
- [ ] Only `mediaContext` metadata persisted; no binary or extracted text stored.
- [ ] Replayed history contains no document text/binaries; ROOT `pnpm typecheck` passes.
