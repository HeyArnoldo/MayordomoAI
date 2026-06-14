# Design: Agent Document Input (Slice 2 — PDF / DOCX / CSV / XLSX)

> Architectural HOW for the `agent-document-input` change. Source of truth for
> scope/intent is `proposal.md`. This document defines components, data flow,
> boundaries, and the ADR-style decisions with rejected alternatives. Tasks are
> derived separately (`sdd-tasks`).

## 1. Architecture Overview

### 1.1 Guiding principle: parity with Slice 1, divergence only where the medium forces it

Slice 1 (images) established a clean shape that Slice 2 MUST reuse:

- `mediaContext: MediaItem[]` metadata persisted on the user message (never the binary).
- A shared, channel-agnostic validation/limits module (`media.constants.ts` + `media.helpers.ts`).
- Two channel adapters (web controller, WhatsApp service) that converge on `AgentService.run(...)`.
- A history-strip guardrail that prevents binaries from being replayed.
- Evolution `getBase64()` for WhatsApp binary retrieval.

The ONE deliberate divergence (ADR-001): images become a native AI-SDK
`ImagePart` (vision tokens); **documents become a server-extracted `text` part.**
Everything downstream of "produce text parts for the turn" is identical to the
existing text path, which is why this slice needs **no new agent tool** and
**no model/provider change**.

### 1.2 Layering

```
                ┌──────────────────────────────────────────────┐
 Web composer   │  apps/web .../chat-thread.tsx                 │  accept=doc mimes
 (FileUIPart)   │  → data-URL `file` parts in last user message │
                └───────────────┬──────────────────────────────┘
                                │ POST /chat  (UIMessage[])
                ┌───────────────▼──────────────────────────────┐
 WhatsApp       │  chat.controller.ts                            │
 documentMessage│   - branch file parts → image vs document      │
 (getBase64)    │   - validateDocument(...)  → reject | meta     │
                │   - extractDocumentText(...) → text part(s)    │
                └───────────────┬──────────────────────────────┘
                                │            ▲
                                │            │ same primitives
                ┌───────────────▼────────────┴─────────────────┐
 SHARED CORE    │  agent/media.constants.ts   (limits/allowlist)│
 (pure-ish)     │  agent/media.helpers.ts     (validate, strip) │
                │  agent/document.extract.ts  (extractors)       │  ◄── NEW
                └───────────────┬──────────────────────────────┘
                                │ text parts + mediaContext
                ┌───────────────▼──────────────────────────────┐
 AGENT          │  AgentService.run(...)  (unchanged)            │
                └───────────────────────────────────────────────┘
```

### 1.3 Module placement (ADR-002)

Keep documents inside the existing `apps/api/src/agent/` "media" namespace rather
than creating a new Nest module. Rationale:

- These are **pure functions** (validation, byte math, extraction, serialization),
  not stateful services with DI; they sit beside `media.helpers.ts` and reuse its
  `base64Bytes`. A Nest module/provider would add ceremony with zero benefit.
- Slice 1 already proved this layout: controller and service both import from
  `../agent/media.*`. Documents follow the same import path → minimal diff,
  consistent mental model.

Files:

| File                                     | Status   | Responsibility                                                                    |
| ---------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `apps/api/src/agent/media.constants.ts`  | Modified | add doc caps + `DOCUMENT_MIME_ALLOWLIST`                                          |
| `apps/api/src/agent/media.helpers.ts`    | Modified | `validateDocument`, generalized strip (see §7)                                    |
| `apps/api/src/agent/document.extract.ts` | NEW      | mime dispatcher + per-format extractors + tabular serializer + low-text detection |

## 2. Extraction Module (`document.extract.ts`)

### 2.1 Public surface (the dispatcher)

```ts
export interface ExtractResult {
  text: string; // already char-capped; ready to inject
  pageCount?: number; // PDF only (undefined for docx/csv/xlsx)
  truncated: boolean; // true if char cap or page cap clipped output
}

export async function extractDocumentText(buffer: Buffer, mimeType: string): Promise<ExtractResult>;
```

`extractDocumentText` is the only function the channel adapters call. It:

1. Routes by `mimeType` to a per-format extractor (table below).
2. Wraps the extractor in `try/catch` → on parser failure throws a typed
   `DocumentExtractionError` (malformed/zip-bomb/corrupt). Adapters map this to a
   localized fallback (web: `chat.document_rejected`; WhatsApp: i18n key).
3. Applies the char cap + truncation flag (single place, post-extraction).
4. Returns `ExtractResult`. **Low-text detection is a separate decision made by
   the caller** via `isLowText(result.text)` so the adapter can choose the
   "can't read as text" message and skip the model — keeping the dispatcher pure
   and the policy testable in isolation.

### 2.2 Per-format extractors (internal)

| MIME                                                                             | Extractor     | Library (ADR-003)            | Output                                                                                                                                    |
| -------------------------------------------------------------------------------- | ------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `application/pdf`                                                                | `extractPdf`  | `pdf-parse`                  | concatenated page text; `pageCount` from `data.numpages`; respect `MAX_PDF_PAGES` (pass `max` option, mark `truncated` if numpages > cap) |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX) | `extractDocx` | `mammoth` (`extractRawText`) | raw text                                                                                                                                  |
| `text/csv`                                                                       | `extractCsv`  | native split / `papaparse`   | normalized rows via tabular serializer                                                                                                    |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX)       | `extractXlsx` | `xlsx` (SheetJS)             | per-sheet serialized rows via tabular serializer                                                                                          |

Note: legacy `application/msword` (.doc) and `application/vnd.ms-excel` (.xls)
are **NOT** in the allowlist this slice (binary formats `mammoth`/clean parsing
don't cover well). Reject them like any unsupported mime.

### 2.3 Tabular serializer (shared by CSV + XLSX) (ADR-004)

`serializeRows(sheetName, rows: string[][]): string`. Decisions:

- Format: **pipe-delimited rows**, one row per line, header row kept as-is. For
  XLSX, prefix each sheet block with `# <sheetName>`. This is compact, readable
  to the model, and avoids markdown-table padding overhead.
- Empty cells → empty string (no `null`/`undefined` leaking into text).
- Hard row cap `MAX_TABULAR_ROWS` per sheet/file; if exceeded, append a
  `… (N more rows omitted)` notice and set `truncated`.
- Trim trailing all-empty columns/rows to avoid XLSX "ghost" ranges inflating
  the char budget.

Example output:

```
# Sheet1
date | merchant | amount
2026-01-03 | Cafe Lima | 12.50
2026-01-04 | Metro | 3.00
… (250 more rows omitted)
```

### 2.4 Low-text detection

`isLowText(text: string): boolean` → `text.trim().length < MIN_EXTRACTED_CHARS`.
This catches scanned/image-only PDFs (which yield ~empty text from `pdf-parse`)
and corrupt-but-parseable files. Caller skips the model and replies with the
localized "can't read as text (OCR is a future slice)" message. Threshold is a
constant so it's tunable and unit-testable.

## 3. Validation & Limits

### 3.1 Constants (`media.constants.ts`)

```ts
export const MAX_DOCUMENTS = 1; // one doc per turn
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024; // 8 MB hard cap (pre-parse)
export const MAX_PDF_PAGES = 30;
export const MAX_EXTRACTED_CHARS = 40_000; // token budget guard
export const MIN_EXTRACTED_CHARS = 20; // low-text threshold
export const MAX_TABULAR_ROWS = 500; // per sheet/file
export const DOCUMENT_MIME_ALLOWLIST = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;
```

Values are the proposal's accepted defaults. They are intentionally conservative
for Coolify memory headroom (§8) and token cost (§9).

### 3.2 `validateDocument(...)` (`media.helpers.ts`)

Mirror `validateImageParts` exactly so the controller branch reads the same:

```ts
export function validateDocument(part: {
  mediaType: string;
  filename?: string | null;
  url?: string; // web data-URL path
  size?: number; // WhatsApp path (already decoded)
}): MediaItem; // throws plain Error on violation
```

Checks (throw plain `Error`; adapter wraps into `AppException` /
`chat.document_rejected`):

- mime ∈ `DOCUMENT_MIME_ALLOWLIST`.
- For the web data-URL path: `url.startsWith('data:')`; decode size via
  `base64Bytes` (reused).
- `size ≤ MAX_DOCUMENT_BYTES` — **enforced BEFORE any parse** (zip-bomb guard).
- Returns `MediaItem` metadata (`type: 'document'`, mediaType, filename, size;
  `pageCount` is filled later, after extraction, by the adapter — keep validation
  size-only and synchronous).

Count cap (`MAX_DOCUMENTS = 1`) is enforced by the adapter when it collects
document file parts (symmetry with `MAX_IMAGES`).

### 3.3 Truncation behavior

When `truncated === true`, the adapter appends a localized notice as a separate
trailing text part (or sentence) so the model knows context was clipped, e.g.
`[Note: document truncated to fit limits — some content omitted]`. The notice is
i18n-driven (conversation locale), not hardcoded English in the prompt.

## 4. Contract Change (`packages/contracts`)

### 4.1 `mediaItemSchema` → discriminated union (ADR-005)

Backward-compatible widening of `MediaItem`:

```ts
const imageMediaItemSchema = z.object({
  type: z.literal('image'),
  mediaType: z.string(),
  filename: z.string().nullable(),
  size: z.number().int().nullable(),
});

const documentMediaItemSchema = z.object({
  type: z.literal('document'),
  mediaType: z.string(),
  filename: z.string().nullable(),
  size: z.number().int().nullable(),
  pageCount: z.number().int().nullable().optional(), // PDF only; additive
});

export const mediaItemSchema = z.discriminatedUnion('type', [
  imageMediaItemSchema,
  documentMediaItemSchema,
]);
export type MediaItem = z.infer<typeof mediaItemSchema>;
```

Why backward compatible:

- Existing persisted rows are all `type: 'image'` and still validate against the
  union's image member — no migration, the `mediaContext` JSON column is
  untouched (matches the proposal's rollback plan).
- `pageCount` is optional → image construction sites (`whatsapp.service.ts`,
  `media.helpers.ts`) compile unchanged.
- Discriminated union (not a loose `type: z.enum(['image','document'])`) gives
  exhaustive narrowing in TS, so the history-strip switch (§7) is type-safe.

### 4.2 Error code + i18n (TS1360 gate — REQUIRED TASK)

- `error-codes.ts`: add `'chat.document_rejected'` to `ERROR_CODES`.
- `packages/i18n/src/locales/es/errors.ts` (source of truth) **and**
  `en/errors.ts` (`satisfies typeof es`): add `chat.document_rejected`.
- **TS1360 gate**: `es/errors.ts` ends with the
  `true satisfies ErrorCode extends DotKeys<...> ? true : never;` assertion.
  Adding the code WITHOUT the matching translation key fails ROOT `pnpm typecheck`
  with TS1360/`never`. The task list MUST treat "add code + both translations" as
  one atomic unit and run **ROOT `pnpm typecheck`** as the gate, not per-package.

Proposed copy (neutral/professional):

- EN: `The document could not be read. Check the file type, size, or that it contains selectable text.`
- ES: `No se pudo leer el documento. Revisa el tipo de archivo, el tamaño o que contenga texto seleccionable.`

WhatsApp-channel fallback strings live under the `whatsapp.*` namespace in
`locales/{en,es}/api.ts` (alongside `imageNotUnderstood`/`imageTooLarge`):

- `documentNotUnderstood` (parser failure / unsupported)
- `documentTooLarge`
- `documentNoText` (low-text / scanned)

## 5. Web Path (controller + composer)

### 5.1 How the file reaches the controller — SAME as images (confirmed in code)

The web composer uses AI-SDK `PromptInput`, which serializes attachments as
data-URL `file` parts inside the last `UIMessage`. The controller already does:

```ts
const fileParts = last.parts.filter((p) => p.type === 'file');
```

So documents arrive on the **identical channel** as images — no multipart, no new
endpoint. The composer change is purely the `accept` list + size/count limits.

`apps/web/.../chat-thread.tsx`:

- `accept="...image mimes... ,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"`.
- Add doc-aware client limits. NOTE the current `maxFileSize={MAX_IMAGE_BYTES}`
  (4 MB) would block 8 MB docs. Since `PromptInput` takes a single
  `maxFileSize`, set it to the larger `MAX_DOCUMENT_BYTES` (8 MB) and let the
  **server** enforce the per-type cap (image 4 MB vs doc 8 MB) authoritatively —
  client limits are UX hints, server is the source of truth. Keep the
  "must match server-side constants" comment honest by documenting this split.

### 5.2 Controller flow (`chat.controller.ts`)

In the existing `if (last?.role === 'user')` file-parts block, branch by mime:

```
collect file parts
  ├─ image parts  → validateImageParts(...)        (unchanged)
  └─ document parts→ validateDocument(...)          (count ≤ MAX_DOCUMENTS)
                    → decode base64 buffer
                    → extractDocumentText(buffer, mime)
                       ├─ throws         → AppException('chat.document_rejected', 400)
                       └─ isLowText(text)→ AppException('chat.document_rejected', 400)
                                           (message = "no selectable text")
                    → set mediaContext item (with pageCount, size)
                    → REPLACE/AUGMENT the user turn's parts:
                         remove the binary file part,
                         prepend a text part:
                           `Document: <filename>\n\n<extractedText>[truncation notice]`
                         keep the user's typed caption text part after it.
```

Key points:

- The **extracted text is injected into the model turn but NOT persisted**: the
  persisted user message `content` stays the caption (or a `[document: <name>]`
  placeholder when caption is empty), `mediaContext` holds metadata only. This is
  exactly how images persist (caption + metadata), so `appendMessage` is unchanged.
- Mixed image+document in one turn: out of scope for v1 simplicity — if both
  present, reject documents path or process images only; recommend rejecting with
  `chat.document_rejected` (single-medium-per-turn keeps validation simple and
  matches `MAX_DOCUMENTS = 1`). Document this as a known limitation.
- Error surfacing: same `AppException` → `ApiError` shape the web client already
  renders (`toast.error`), reusing the existing error pipeline.

## 6. WhatsApp Path (`whatsapp.service.ts`)

### 6.1 Payload type extension

```ts
message?: {
  ...
  imageMessage?: { caption?: string; mimetype?: string };
  documentMessage?: { caption?: string; mimetype?: string; fileName?: string };
  base64?: string;
};
```

(Evolution uses `fileName` for documents; map to our `filename`.)

### 6.2 Dispatch branch (beside the image branch in `processInbound`)

```ts
if (data?.message?.documentMessage) {
  const reply = await this.handleDocument(user, e164, key.id, data.message.documentMessage);
  if (reply !== null) await this.evolution.sendText(e164, reply);
  return;
}
```

Placed before the `if (!text)` text-only fallback, mirroring the image branch.

### 6.3 `handleDocument(...)` — mirror `handleImage`

```
getBase64(messageId)             // try/catch → whatsapp.documentNotUnderstood
  → buffer = Buffer.from(base64,'base64')
  → validateDocument({ mediaType: mimetype, size: buffer.length, filename })
       fail → whatsapp.documentTooLarge | documentNotUnderstood
  → extractDocumentText(buffer, mimetype)
       throws  → whatsapp.documentNotUnderstood
       lowText → whatsapp.documentNoText      (skip model)
  → mediaContext = [{ type:'document', mediaType, filename, size, pageCount }]
  → persist user turn: content = caption || `[document: <filename>]`, mediaContext
  → build model turn: [ text(extracted + notice), text(caption?) ]
       (NOTE: divergence from image — both parts are TEXT, no ImagePart)
  → history (text-only) minus current → run agent → reply → persist assistant
```

Caption handling: same as image — caption becomes the trailing user-text part and
the persisted `content`. `isAiEnabled()` false → `whatsapp.aiDisabled` fallback,
identical to `handleImage`.

## 7. History / Persistence Strategy

### 7.1 Never persist binary or extracted text

- Persisted user message: `content` = caption/placeholder, `mediaContext` =
  metadata only (web and WhatsApp identical). Extracted text exists ONLY in the
  in-flight model turn and is GC'd after the request. This satisfies the
  "documents are ephemeral" non-goal and the cost guard.

### 7.2 Generalize `stripImagesFromHistory` → `stripMediaFromHistory` (ADR-006)

Recommendation: **generalize**, do not duplicate. Rationale (lower risk):

- The current helper already strips ALL `file` parts (it keys on `p.type ===
'file'`, not on image-ness). On the **web path** documents arrive as `file`
  parts in history, so `stripImagesFromHistory` ALREADY removes them — but it
  labels every placeholder `[image: ...]`, which is wrong for documents.
- A parallel `stripDocumentsFromHistory` would double-walk the message array and
  risk divergent "last user message" logic. One generalized pass is safer.

Change: rename to `stripMediaFromHistory` (keep a re-export alias
`stripImagesFromHistory` for one release to avoid churn in the controller import,
OR update the single import site — single site, so just update it). Inside the
placeholder mapping, choose the label by inspecting the part:

```ts
const label = filePart.filename ?? filePart.mediaType ?? 'file';
const isDoc = (filePart.mediaType ?? '').match(/pdf|word|sheet|csv|excel/i);
return { type: 'text', text: `${isDoc ? '[document' : '[image'}: ${label}]` };
```

Better: drive the prefix off `mediaContext` when available, but since the strip
operates on `UIMessage.parts` (which only carry `mediaType`/`filename`), the
mime-based heuristic is acceptable and unit-testable. WhatsApp history is already
text-only (no file parts persisted), so the strip only matters for the web path.

## 8. Security / Memory

- **Hard size cap BEFORE parse** (`MAX_DOCUMENT_BYTES`, 8 MB) — the single most
  important guard against zip-bombs and OOM. Enforced in `validateDocument`
  before `extractDocumentText` is ever called.
- **try/catch around every parser** inside `document.extract.ts` → typed
  `DocumentExtractionError`; never let a parser exception escape to a 500.
- **Bounded output**: char cap + row cap + page cap applied in the extractor, so
  even a valid-but-huge file can't blow memory/tokens.
- **In-memory only**: buffer decoded, parsed, text injected, buffer dropped. No
  disk, no object storage (matches non-goals).
- **One doc per turn** (`MAX_DOCUMENTS = 1`) bounds peak memory per request —
  important under Coolify's constrained memory. Release the buffer reference
  immediately after extraction (don't hold it in `mediaContext`).
- Logging: log parser failures with messageId (WhatsApp) like `handleImage`
  already does; never log document content (PII — bank statements).

## 9. Usage / Cost

- Extracted text enters the turn as ordinary input tokens under the existing
  `kind: 'agent'` accounting — no new usage category, no metering change.
- The **char cap (`MAX_EXTRACTED_CHARS = 40k`) is the cost guard**: ~40k chars ≈
  ~10–13k tokens, a bounded, predictable per-document ceiling. Truncation notice
  tells the user/model when the cap clipped content.
- No vision tokens (the whole point of extract-then-inject) → cheaper than the
  image path for equivalent information density.

## 10. Testability (TDD-first targets)

Pure / mostly-pure units (test FIRST, no I/O):

1. `validateDocument` — allowlist accept/reject, size-cap boundary
   (`MAX_DOCUMENT_BYTES ± 1`), data-URL prefix check, returned `MediaItem` shape,
   count cap behavior.
2. `serializeRows` (tabular serializer) — pipe formatting, empty cells, sheet
   header prefix, row-cap truncation notice, trailing-empty trimming.
3. truncation logic — char cap clips at `MAX_EXTRACTED_CHARS`, sets `truncated`,
   notice appended.
4. `isLowText` — threshold boundary (`MIN_EXTRACTED_CHARS ± 1`), whitespace-only.
5. `extractDocumentText` dispatcher — routes mime → correct extractor (extractors
   **mocked**), unknown mime → throws, parser throw → `DocumentExtractionError`,
   char cap applied centrally.
6. `stripMediaFromHistory` — image vs document label selection, last-user-message
   preserved, no-file-parts returns same reference, no mutation.

Service / adapter branches (mock `EvolutionClient.getBase64` + `AgentService.run`):

7. `handleDocument` (WhatsApp) — happy path (extract → run → reply), getBase64
   throw → `documentNotUnderstood`, oversize → `documentTooLarge`, low-text →
   `documentNoText` (model NOT called), AI disabled → `aiDisabled`.
8. Controller document branch — validate→extract→inject, reject path →
   `chat.document_rejected`, low-text → reject, persistence asserts
   (content=caption/placeholder, mediaContext metadata, no extracted text stored).

Per-format extractors (the I/O-touching minority):

9. Use **small inline fixtures** committed as tiny base64 blobs or generated
   in-test (e.g. build a 1-row XLSX with `xlsx` in the test, a 2-line CSV string,
   a minimal DOCX/PDF fixture < a few KB). Prefer **mocking the library** for the
   dispatcher tests (target #5) and reserve real-fixture tests for ONE
   round-trip per format to confirm wiring. This keeps the suite fast and avoids
   committing large binaries.

## 11. Trade-offs / ADRs

### ADR-001 — Extract-then-inject (text part) vs vision-on-pages

**Decision**: server extracts text, injects as `text` part. **Rejected**:
rendering PDF pages to images + vision (Slice 1 style). **Why**: model-agnostic,
no vision-token cost, reuses the entire text pipeline (no new tool), and most
finance docs (statements, CSVs, DOCX) are text-native. Vision-on-pages is
explicitly deferred to a future OCR slice for scanned/image-only PDFs.

### ADR-002 — Place in `agent/` media namespace vs new Nest module

**Decision**: extend `agent/media.*` + new `agent/document.extract.ts`.
**Rejected**: a `documents` Nest module. **Why**: pure functions, no DI/state,
Slice 1 precedent, smallest diff.

### ADR-003 — Library choices

- **PDF: `pdf-parse`** vs `pdfjs-dist`/`unpdf`. Chosen: `pdf-parse` — tiny,
  synchronous-ish API, pure-JS (no native deps, Coolify-safe), gives `numpages`
  for the page cap. Risk: less control over layout; acceptable for text
  extraction. `unpdf` is a viable fallback if `pdf-parse` maintenance becomes an
  issue.
- **DOCX: `mammoth`** (`extractRawText`) — purpose-built, pure-JS, clean text.
- **XLSX: `xlsx` (SheetJS)** vs `exceljs`. Chosen: `xlsx` — smaller, faster
  read-only `sheet_to_json`/`sheet_to_csv`, no styling baggage (we only need
  cell values). `exceljs` is heavier and streaming-oriented (write-focused),
  disproportionate for read-only row extraction (proposal risk R5). If `xlsx`
  bundle/security concerns surface, defer XLSX to Slice 2b (proposal-sanctioned).
- **CSV: native split or `papaparse`**. Chosen: start with a minimal native
  parser feeding `serializeRows`; adopt `papaparse` only if quoting/escaping
  edge cases appear. Keeps the dependency surface minimal.

### ADR-004 — Tabular serialization: pipe-rows vs agent-side column inference

**Decision**: server emits compact pipe-delimited rows (capped). **Rejected**:
hand raw cells to the agent and let it infer structure. **Why**: deterministic,
testable, bounded char cost; the agent still does the financial reasoning on a
clean tabular text.

### ADR-005 — Discriminated union vs loose enum for `MediaItem.type`

**Decision**: `z.discriminatedUnion('type', [...])` with optional additive
`pageCount` on the document member. **Rejected**: `type: z.enum(['image',
'document'])` flat schema. **Why**: exhaustive TS narrowing for the strip switch,
backward-compatible (old image rows validate), no migration.

### ADR-006 — Generalize `stripImagesFromHistory` vs add parallel helper

**Decision**: generalize to `stripMediaFromHistory` (label chosen per part).
**Rejected**: parallel `stripDocumentsFromHistory`. **Why**: the existing helper
already strips all `file` parts; a parallel pass risks divergent last-user logic
and double traversal. Lower risk to generalize one well-tested function.

## 12. Out-of-scope reminders (carried from proposal)

OCR/scanned PDFs, object storage, document-text history replay, embedded
images/charts, rich layout/table fidelity, auto-creating transactions without
user confirmation, multi-document-per-turn.
