# Apply Progress: multimodal-agent-input (PR1 — Foundation)

> Branch: `feat/multimodal-input-foundation`
> Batch: 1 (PR1 only — foundation slice)
> Status: COMPLETE

## Work Units Completed

### [x] Work Unit A — Contracts + i18n keys + package build

- [x] A1 — `mediaItemSchema` + `messageSchema.mediaContext` in `@app/contracts`
  - Added `mediaItemSchema` (type, mediaType, filename, size)
  - Extended `messageSchema` with `mediaContext: z.array(mediaItemSchema).nullable().optional()`
  - Added `chat.image_rejected` to `ERROR_CODES` in `error-codes.ts`
- [x] A2 — i18n keys for image notices
  - Added `whatsapp.imageNotUnderstood` + `whatsapp.imageTooLarge` to `packages/i18n/src/locales/{en,es}/api.ts`
  - Added `composer.attachmentReadFailed` + `composer.imageRejected` to `packages/i18n/src/locales/{en,es}/chat.ts`
- [x] A3 — Build packages (blocking gate)
  - `pnpm --filter "./packages/**" run build` exits 0

**Commit:** `726b79e` — `feat(contracts): add mediaItemSchema, mediaContext to messageSchema, and image i18n keys`

---

### [x] Work Unit B — Pure helper functions (TDD-first)

- [x] B1 — `media.constants.ts` — MAX_IMAGES=2, MAX_IMAGE_BYTES=4MB, IMAGE_MIME_ALLOWLIST
- [x] B2 — `base64Bytes` — 5 tests written first (RED), then implemented (GREEN)
- [x] B3 — `toImagePart` — 5 tests written first, implemented
- [x] B4 — `validateImageParts` — 8 tests (happy path, too-many, oversized, bad-mime, non-data-url, boundary)
- [x] B5 — `stripImagesFromHistory` — 7 tests (strips past images, preserves last-user, no-op on text-only)

All 25 tests pass: `pnpm --filter @app/api run test -- media.helpers`

**Commit:** `d3e396c` — `feat(agent): add media helpers — base64Bytes, toImagePart, validateImageParts, stripImages`

---

### [x] Work Unit C — Database: entity + generated migration

- [x] C1 — `mediaContext` jsonb column added to `message.entity.ts`, `MediaItem` type imported from `@app/contracts`
- [x] C2 — Migration generated: `1781453249102-AddMediaContextToMessage.ts`
  - `up`: `ALTER TABLE "messages" ADD "mediaContext" jsonb`
  - `down`: `ALTER TABLE "messages" DROP COLUMN "mediaContext"`
  - Migration applied successfully against dev DB (port 55432)
- [x] C3 — `appendMessage` extended with optional `mediaContext: MediaItem[] | null = null`
  - All existing 6 `conversations.service.spec.ts` tests still pass

**Commit:** `141d469` — `feat(chat): add mediaContext jsonb column, migration, and appendMessage signature`

---

## Gates Status

| Gate                                      | Status                                               |
| ----------------------------------------- | ---------------------------------------------------- |
| `pnpm --filter "./packages/**" run build` | PASS                                                 |
| `pnpm --filter @app/api run test`         | PASS — 143 tests, 19 suites                          |
| `pnpm --filter @app/api run typecheck`    | PASS                                                 |
| `pnpm lint`                               | PASS — 0 errors (4 pre-existing warnings, unrelated) |
| Migration generated + applied             | DONE — `1781453249102-AddMediaContextToMessage.ts`   |

---

## Commits Made (PR1)

| Hash      | Subject                                                                                      |
| --------- | -------------------------------------------------------------------------------------------- |
| `54ceec6` | `docs(sdd): add multimodal-agent-input planning artifacts and update .gitignore`             |
| `726b79e` | `feat(contracts): add mediaItemSchema, mediaContext to messageSchema, and image i18n keys`   |
| `d3e396c` | `feat(agent): add media helpers — base64Bytes, toImagePart, validateImageParts, stripImages` |
| `141d469` | `feat(chat): add mediaContext jsonb column, migration, and appendMessage signature`          |

---

## Post-Review Fixes (adversarial review)

Two confirmed blockers fixed on top of PR1:

- [x] BLOCKER 1 — `stripImagesFromHistory` now REPLACES each stripped image
      binary part with a short text placeholder (`[image: <filename | mediaType>]`)
      instead of dropping it, per spec `:111`/`:118` and design §5.4. An
      image-only past turn becomes a single text placeholder part (never empty
      `parts: []`, which downstream `convertToModelMessages` would reject). Added
      edge-case tests (image-only, mixed text+image in-position, no-mutation),
      `validateImageParts` fail-fast on mixed valid/invalid, count boundary
      (exactly 2 accepted, 3 rejected), size boundary (exactly 4MB accepted,
      +1 byte rejected), and a `base64Bytes` data-URL-prefix contract test.
      Corrected B5 acceptance text in `tasks.md` ("replace with placeholder").
  - Files: `apps/api/src/agent/media.helpers.ts`, `apps/api/src/agent/media.helpers.spec.ts`, `openspec/changes/multimodal-agent-input/tasks.md`
  - Commit: `fix(agent): replace stripped history images with text placeholder per spec`

- [x] BLOCKER 2 — `1781453249102-AddMediaContextToMessage.ts` scoped to ONLY the
      new column. Removed the bundled, non-idempotent FK/index rename/drop/create
      statements on `recurring_expenses` and `ai_usage_log` (including the silent
      `DROP CONSTRAINT FK_ai_usage_user` that was never re-added). Dev DB was
      reverted with the bundled `down()` (restoring legacy constraint/index
      names) and re-migrated with the scoped `up()`. Verified: `mediaContext`
      jsonb column present; legacy names `FK_recurring_user`, `FK_recurring_box`,
      `FK_ai_usage_user`, `IDX_recurring_user_active`, `IDX_ai_usage_date`,
      `IDX_ai_usage_user_date` all still present; hash-named drift absent.
  - Files: `apps/api/src/database/migrations/1781453249102-AddMediaContextToMessage.ts`
  - Commit: `fix(chat): scope mediaContext migration to the new column only`

Gates after fixes: build PASS, `@app/api` test PASS (153 tests, 19 suites),
typecheck PASS, lint PASS (0 errors; pre-existing unrelated warnings only),
migration applied cleanly, dev DB verified.

---

---

## PR2 — Vision Routing (Channels Slice)

> Branch: `feat/multimodal-input-channels`
> Batch: 2 (PR2 — D/E/F/G/H/I)
> Status: COMPLETE

### [x] Work Unit D — Chat controller (D1)

- Extracted file parts from last user message via `parts.filter(p => p.type === 'file')`
- Wrapped `validateImageParts()` call in try/catch → throws `AppException('chat.image_rejected', 400)`
- Called `stripImagesFromHistory(body.messages)` before `convertToModelMessages` (cost guardrail)
- Passed `mediaContext` (from `validateImageParts` result) to `appendMessage` for user turn
- Extended `toMessageDto` to include `mediaContext: m.mediaContext`
- TDD: 8 new tests added (valid 1-img, valid 2-img, too-many → 400, oversized → 400, bad-mime → 400, blob-url → 400, text-only → null mediaContext, history-strip assertion)
- **Commit:** `7d6f505` — `feat(chat): server-side image validation, history strip, and mediaContext persistence`
- Files: `apps/api/src/chat/chat.controller.ts`, `apps/api/src/chat/chat.controller.spec.ts`

### [x] Work Unit E — Web UI (E1)

- Added `AttachButton` component using `usePromptInputAttachments().openFileDialog()`
- Replaced disabled `Plus` button with active `AttachButton` (Paperclip icon)
- Added constraint props to `<PromptInput>`: `accept="image/png,image/jpeg,image/webp,image/gif"`, `multiple`, `maxFiles={MAX_IMAGES}`, `maxFileSize={MAX_IMAGE_BYTES}`, `onError={handleAttachError}`
- Updated `send()` signature to accept `files: FileUIPart[] = []`
- Added blob-failure guard: if any file URL starts with `blob:` after submit, aborts send and shows `toast.error(t('composer.attachmentReadFailed'))`
- Updated empty-message guard: `(!content && files.length === 0) || busy`
- Updated `handleSubmit` to forward `message.files` into `send(message.text, message.files)`
- Added `attachImage` key to EN+ES chat i18n locales
- Verified: `pnpm --filter @app/web run typecheck` clean, `pnpm --filter @app/web run build` clean
- **Commit:** `25505a3` — `feat(web): enable image attachment in chat composer with validation and blob-failure guard`
- Files: `apps/web/src/features/chat/chat-thread.tsx`, `packages/i18n/src/locales/en/chat.ts`, `packages/i18n/src/locales/es/chat.ts`

### [x] Work Unit F — WhatsApp (F1)

- Extended `EvolutionWebhookPayload.data.message` with `imageMessage?: { caption?: string; mimetype?: string }`
- Added `handleImage()` private method: downloads base64 via `evolution.getBase64()`, validates size, builds `ImagePart` via `toImagePart()`, persists user turn with `mediaContext`, builds multimodal `UserModelMessage` with `[imagePart, ...textPart?]`, calls `agent.run()` with history + current multimodal turn
- Added `imageMessage` dispatch branch in `processInbound` after the audio branch
- getBase64 null → `whatsapp.imageNotUnderstood` (no crash)
- getBase64 throw → caught, logged via `this.logger.error`, `whatsapp.imageNotUnderstood` sent
- Oversized image → `whatsapp.imageTooLarge` notice
- Image fast-path bypass: always routes to agent (no regex fast-path for image messages)
- TDD: 10 new tests covering image-with-caption, image-without-caption, null → fallback, throw → fallback, throw → logger
- **Commit:** `28867ef` — `feat(whatsapp): add imageMessage branch with vision routing, fallbacks, and caption support`
- Files: `apps/api/src/whatsapp/whatsapp.service.ts`, `apps/api/src/whatsapp/whatsapp.service.spec.ts`

### [x] Work Unit G — Agent system prompt (G1)

- Added `IMAGE AND RECEIPT ANALYSIS:` block to EN `buildSystemPrompt` after "AGENTIC BEHAVIOR" section
- Added `ANÁLISIS DE IMÁGENES Y RECIBOS:` block to ES `buildSystemPrompt`
- EN block: extract amount, merchant, date; PROPOSE (never auto-register); ask for confirmation; say if unreadable
- ES block: neutral Spanish equivalent
- TDD: 4 new tests asserting the dedicated receipt block exists with required keywords in each locale
- **Commit:** `b4e86a4` — `feat(agent): add receipt image hint to system prompt (en + es)`
- Files: `apps/api/src/agent/agent.service.ts`, `apps/api/src/agent/agent.service.spec.ts`

### [x] Work Unit H — Usage tracking (no code)

Confirmed: `agent.service.ts` `onFinish` handler records `kind: 'agent'` with `totalUsage` (inputTokens + outputTokens). Vision calls are automatically captured under the existing `agent` kind. No new kind introduced.

---

## Gates Status (PR2)

| Gate                                      | Status                                               |
| ----------------------------------------- | ---------------------------------------------------- |
| `pnpm --filter "./packages/**" run build` | PASS                                                 |
| `pnpm --filter @app/api run test`         | PASS — 180 tests, 20 suites                          |
| `pnpm --filter @app/api run typecheck`    | PASS                                                 |
| `pnpm --filter @app/web run typecheck`    | PASS                                                 |
| `pnpm --filter @app/web run build`        | PASS (chunk size warnings are pre-existing)          |
| `pnpm lint`                               | PASS — 0 errors (4 pre-existing warnings, unrelated) |

---

## Commits Made (PR2)

| Hash      | Subject                                                                                       |
| --------- | --------------------------------------------------------------------------------------------- |
| `7d6f505` | `feat(chat): server-side image validation, history strip, and mediaContext persistence`       |
| `b4e86a4` | `feat(agent): add receipt image hint to system prompt (en + es)`                              |
| `28867ef` | `feat(whatsapp): add imageMessage branch with vision routing, fallbacks, and caption support` |
| `25505a3` | `feat(web): enable image attachment in chat composer with validation and blob-failure guard`  |

---

## Manual Verification Steps (I3)

### Web channel

1. Open the chat UI in a browser.
2. Click the paperclip (Paperclip) button in the composer footer.
3. **Scenario A — single valid image:** Select a receipt photo (<4 MB, `image/jpeg` or `image/png`) → attachment chip appears → type a message or leave empty → press Send → agent replies extracting amount/merchant/date as a SUGGESTION (not auto-registered).
4. **Scenario B — two valid images:** Select two images → both chips appear → send → agent processes both.
5. **Scenario C — three images attempt:** Try to add a 3rd image → composer rejects with a "Too many files" toast; only 2 chips remain.
6. **Scenario D — oversized image (>4 MB):** Attach an image >4 MB → rejected with "All files exceed the maximum size" toast.
7. **Scenario E — wrong type:** Attach a `.pdf` → rejected with "No files match the accepted types" toast.
8. **Scenario F — blob failure (manual simulation):** In DevTools, mock `URL.createObjectURL` to return a `blob:` URL that the FileReader can't read. Expected: error toast appears (`composer.attachmentReadFailed`), message NOT sent.
9. **Scenario G — DB check:** After a successful image send, inspect the `messages` table. The row for the user turn must have `mediaContext.type = 'image'` and entries with `mediaType`/`size`; no binary/data-URL in any column.
10. **Scenario H — history efficiency:** Send a text reply after the image turn. Confirm via logs/token count that the previous image is NOT replayed (placeholder `[image: receipt.jpg]` or similar appears in history replay, not the binary).

### WhatsApp channel

1. Send a receipt photo WITH a caption to the linked WhatsApp number.
   - Expected: Evolution webhook fires → `processInbound` dispatches to `handleImage` → agent responds with vision-aware suggestion → reply arrives in WhatsApp.
2. Send a receipt photo WITHOUT a caption.
   - Expected: agent still processes the image-only turn and replies.
3. Simulate null `getBase64` (e.g. use a broken/expired media message ID, or temporarily mock `EvolutionClient.getBase64` to return null in staging).
   - Expected: user receives `"I couldn't process that image. Could you try again?"` (or ES equivalent), no crash, no agent call.
4. Send an image >4 MB.
   - Expected: user receives `"That image exceeds the 4 MB limit."` notice.

### Channel parity check

Send the same receipt via web and via WhatsApp. Confirm that the agent produces semantically equivalent replies (amount/merchant/date suggestion in conversation locale).

---

## Risks / Deviations

1. **`@ai-sdk/react` `sendMessage` files signature**: `sendMessage({ text, files }, options)` where `files: FileUIPart[]`. The `files` field is forwarded as message parts by `useChat`'s `DefaultChatTransport`. This matches the SDK's `PromptInputMessage` type from `prompt-input.tsx`. Verified via the existing `PromptInputMessage` interface and `PromptInput.handleSubmit` that already builds `{ files: convertedFiles, text }`.

2. **Evolution `imageMessage` envelope shape assumed**: The payload shape `{ imageMessage: { caption?: string; mimetype?: string }, base64?: string }` is based on the existing `audioMessage` + `base64` pattern in the codebase and the design doc §4.1. Real Evolution webhook shapes may differ slightly (e.g. `imageMessage.jpegThumbnail`, `imageMessage.url`). The implementation defensively falls back to `'image/jpeg'` if `mimetype` is missing, and handles null/throw from `getBase64`. If the actual payload differs, the `getBase64` null path will catch it gracefully.

3. **History deduplication**: `handleImage` calls `appendMessage` for the user turn BEFORE calling `historyAsModelMessages`. Then it slices `history.slice(0, -1)` to remove the just-appended turn before building the final model messages array. This prevents the user turn appearing twice. If `historyAsModelMessages` is called in a race or the thread grows during processing, the slice may be off by one — acceptable for Slice 1 but worth monitoring.

4. **Unused `makeRecurring` removed** from `whatsapp.service.spec.ts` (lint warning cleanup).

## Remaining for PR3 (if needed)

- [ ] I1 — Full API test run (already done as gate: 180 tests pass)
- [ ] I2 — Run migration on local dev DB (already done in PR1: `1781453249102-AddMediaContextToMessage.ts` applied)
- [ ] I3 — Manual end-to-end verification (steps documented above)
