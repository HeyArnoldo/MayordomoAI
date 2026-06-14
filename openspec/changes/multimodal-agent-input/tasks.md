# Tasks: Multimodal Agent Input (Slice 1 — Images)

> Artifact store: openspec  
> TDD mode: STRICT (API only — `pnpm --filter @app/api run test`)  
> Feature branch: `feat/multimodal-agent-input` — never push directly to `main`  
> Build order constraint: build `@app/contracts` + `@app/i18n` before any API typecheck / migration / test that resolves them

---

## Work Unit A — Contracts + i18n keys + package build

**Sequential prerequisite for all API units.**  
Satisfies: `agent-chat/spec.md § messageSchema Contract Extension`, `multimodal-input/spec.md` (all channels share the contract)

### A1 — `mediaItemSchema` + `messageSchema.mediaContext` in `@app/contracts`

- TDD: No (schema library code, validated via TypeScript compiler + downstream usage)
- Files:
  - `packages/contracts/src/chat.ts` — add `mediaItemSchema`, extend `messageSchema` with optional `mediaContext: z.array(mediaItemSchema).nullable().optional()`
- Verification: `pnpm --filter @app/contracts build` exits 0; exported types resolve correctly

### A2 — i18n keys for image notices

- TDD: No (string resources)
- Files:
  - `apps/api/src/i18n/en.json` (or equivalent locale file) — add keys:
    - `whatsapp.imageNotUnderstood`
    - `whatsapp.imageTooLarge`
    - `chat.image_rejected`
    - `chat.attachmentReadFailed`
  - `apps/api/src/i18n/es.json` — neutral-Spanish equivalents for all four keys
- Verification: `pnpm --filter @app/i18n build` exits 0; key names match references in subsequent tasks

### A3 — Build packages (blocking gate)

- TDD: No (build step, not code)
- Command: `pnpm --filter "./packages/**" run build`
- Verification: both `@app/contracts` and `@app/i18n` emit dist artifacts with no type errors

**Commit after A3:** `feat(contracts): add mediaItemSchema and imageNotUnderstood i18n keys`

---

## Work Unit B — Pure helper functions (TDD-first)

**Can run in parallel with A after A1 is committed (types are available from source; build needed only for API consumer tests).**  
All functions go in `apps/api/src/agent/media.helpers.ts` (new file). Constants go in `apps/api/src/agent/media.constants.ts` (new file).  
Satisfies: `multimodal-input/spec.md § Channel Parity`, design §§2, 4.2, 5.4, 8, 10

### B1 — `media.constants.ts` — shared limits

- TDD: No (constants)
- Files:
  - `apps/api/src/agent/media.constants.ts` (new) — `MAX_IMAGES = 2`, `MAX_IMAGE_BYTES = 4 * 1024 * 1024`, `IMAGE_MIME_ALLOWLIST`

### B2 — `base64Bytes(base64: string): number` — TDD first

- TDD: YES — write tests first
- Files:
  - `apps/api/src/agent/media.helpers.spec.ts` (new) — test cases: normal base64, single `=` padding, `==` padding, empty string
  - `apps/api/src/agent/media.helpers.ts` (new) — implement `base64Bytes`
- Test target: `pnpm --filter @app/api run test -- media.helpers`

### B3 — `toImagePart(base64, mimetype): ImagePart` — TDD first

- TDD: YES — write tests first
- Files:
  - `apps/api/src/agent/media.helpers.spec.ts` — add: builds correct data-URL, sets `mediaType`, handles various mime types
  - `apps/api/src/agent/media.helpers.ts` — implement `toImagePart`
- Test target: `pnpm --filter @app/api run test -- media.helpers`

### B4 — `validateImageParts(parts): MediaItem[]` — TDD first

- TDD: YES — write tests first
- Files:
  - `apps/api/src/agent/media.helpers.spec.ts` — add scenarios: happy path (1 image), happy path (2 images), too many images → throws, oversized → throws, bad mime → throws, non-data-url → throws, returns correct `MediaItem[]` shape
  - `apps/api/src/agent/media.helpers.ts` — implement `validateImageParts`; imports `MAX_IMAGES`, `MAX_IMAGE_BYTES`, `IMAGE_MIME_ALLOWLIST` from constants; imports `MediaItem` from `@app/contracts`
- Test target: `pnpm --filter @app/api run test -- media.helpers`

### B5 — `stripImagesFromHistory(messages): UIMessage[]` — TDD first

- TDD: YES — write tests first
- Files:
  - `apps/api/src/agent/media.helpers.spec.ts` — add scenarios: replaces image file parts with a `[image: …]` text placeholder in all messages except the last user message (filename used when present, mediaType fallback otherwise), leaves text/tool parts intact for all messages, image-only message becomes exactly one text placeholder part (never empty parts), does NOT strip the last user message's image parts, handles history with no images (no-op)
  - `apps/api/src/agent/media.helpers.ts` — implement `stripImagesFromHistory`
- Test target: `pnpm --filter @app/api run test -- media.helpers`

**Commit after B5:** `feat(agent): add media helpers with TDD — base64Bytes, toImagePart, validateImageParts, stripImagesFromHistory`

---

## Work Unit C — Database: entity + generated migration

**Sequential — requires A3 (packages built) to typecheck the new `MediaItem` import.**  
Satisfies: `agent-chat/spec.md § mediaContext Metadata Persistence`

### C1 — Add `mediaContext` column to `Message` entity

- TDD: No (TypeORM entity, verified by migration generation)
- Files:
  - `apps/api/src/chat/message.entity.ts` — add `@Column({ type: 'jsonb', nullable: true }) mediaContext: MediaItem[] | null;`; import `MediaItem` from `@app/contracts`
- Verification: `pnpm --filter @app/api run typecheck` (or equivalent) passes

### C2 — Generate and verify migration

- TDD: No (generated artifact)
- Command: `pnpm --filter @app/api migration:generate`
- Files:
  - `apps/api/src/migrations/<timestamp>-AddMediaContextToMessage.ts` (generated) — review: must contain `ADD COLUMN "mediaContext" jsonb`, down must contain `DROP COLUMN "mediaContext"`
- Verification: generated file contains expected DDL; `synchronize` remains `false` in typeorm config

### C3 — Extend `appendMessage` signature in `conversations.service.ts`

- TDD: No (service signature change, verified by TypeScript)
- Files:
  - `apps/api/src/chat/conversations.service.ts` — add optional trailing param `mediaContext: MediaItem[] | null = null`; pass it when calling the repository save; existing call sites unmodified (default `null` preserves backward compatibility)
- Verification: `pnpm --filter @app/api run typecheck` passes; no existing call sites require changes

**Commit after C3:** `feat(chat): add mediaContext jsonb column, migration, and appendMessage signature`

---

## Work Unit D — Chat controller: server-side validation + mediaContext persistence + history strip

**Sequential — requires B4 (validateImageParts), B5 (stripImagesFromHistory), C3 (appendMessage signature), A3 (packages built).**  
Satisfies: `agent-chat/spec.md §§ Image Parts in Agent Turn, mediaContext Metadata Persistence`, `multimodal-input/spec.md § Vision Cost Control — History Strip`

### D1 — Controller: validateImageParts + stripImagesFromHistory + persist mediaContext (TDD — integration-style unit test)

- TDD: YES — write controller unit tests first (mock `AgentService.run` + `appendMessage`)
- Files:
  - `apps/api/src/chat/chat.controller.spec.ts` — add test scenarios:
    - valid image payload: `validateImageParts` called, `AppException` NOT thrown, `appendMessage` receives non-null `mediaContext`
    - too-many images: returns HTTP 400 before calling agent
    - oversized image: returns HTTP 400 before calling agent
    - bad mime: returns HTTP 400 before calling agent
    - non-data-url: returns HTTP 400 before calling agent
    - text-only message: `mediaContext` is `null`, no validation error
    - `stripImagesFromHistory` called on web body messages (past image file parts stripped)
  - `apps/api/src/chat/chat.controller.ts` — add:
    1. Extract file parts from last user message in `body.messages`
    2. Call `validateImageParts(fileParts)` → `MediaItem[]`; wrap in try/catch → throw `AppException('chat.image_rejected', HttpStatus.BAD_REQUEST)`
    3. Call `stripImagesFromHistory(body.messages)` before passing to `convertToModelMessages`
    4. Pass `mediaContext` to `appendMessage` call for the user turn
    5. Extend `toMessageDto` to include `mediaContext: m.mediaContext`
- Test target: `pnpm --filter @app/api run test -- chat.controller`

**Commit after D1:** `feat(chat): server-side image validation, history strip, and mediaContext persistence`

---

## Work Unit E — Web UI: enable attachment button + file wiring + blob-failure guard

**Can run in parallel with C and D (no API dependency — pure UI).**  
Satisfies: `multimodal-input/spec.md § Web Image Attachment` (all scenarios)

### E1 — Enable attachment button, pass files, blob-failure guard in `chat-thread.tsx`

- TDD: No (no web test runner — manual verification steps listed below)
- Files:
  - `apps/web/src/features/chat/chat-thread.tsx`:
    1. Pass constraint props to `<PromptInput>`: `accept="image/png,image/jpeg,image/webp,image/gif"`, `multiple`, `maxFiles={MAX_IMAGES}`, `maxFileSize={MAX_IMAGE_BYTES}`, `onError={handleAttachError}`
    2. Replace disabled `Plus` button with `PromptInputActionAddAttachments` (or equivalent attach trigger)
    3. Update `handleSubmit` to forward `message.files` into `send(message.text ?? '', message.files)`
    4. Update `send()` to pass `{ text, files }` to `sendMessage`; guard: if any file's URL starts with `blob:` after attach, abort send and show `t('chat.attachmentReadFailed')` toast
    5. Update empty-message guard: `if ((!content && files.length === 0) || busy) return`
- Constants: import `MAX_IMAGES`, `MAX_IMAGE_BYTES` from a shared constants path (or inline matching values until contracts expose them to web)
- Manual verification steps:
  - Attach one valid image (<4 MB image/\*) → attachment chip appears → send → agent replies with vision-aware response
  - Attach two valid images → both chips appear → send → agent processes both
  - Attempt to attach 3 images → third is rejected with user-visible error
  - Attach an image >4 MB → rejected with size error
  - Attach a `.pdf` file → rejected with type error
  - Simulate blob-to-dataURL failure → error toast appears, message not sent, files remain in composer

**Commit after E1:** `feat(web): enable image attachment in chat composer with validation and blob-failure guard`

---

## Work Unit F — WhatsApp: imageMessage branch + payload type + fallbacks

**Sequential — requires B2 (`base64Bytes`), B3 (`toImagePart`), A3 (packages + i18n built).**  
Satisfies: `multimodal-input/spec.md § WhatsApp Image Receive` (all scenarios), `agent-chat/spec.md § Image Parts in Agent Turn`

### F1 — Payload type extension + imageMessage branch (TDD — service unit test)

- TDD: YES — write tests first
- Files:
  - `apps/api/src/whatsapp/whatsapp.service.spec.ts` — add test scenarios:
    - inbound imageMessage with caption: `getBase64` called; agent invoked with `content` array containing one image part + one text part with caption; reply sent back
    - inbound imageMessage without caption: agent invoked with content array containing only the image part; reply sent
    - `getBase64` returns null: agent NOT called; `sendText` called with `whatsapp.imageNotUnderstood` i18n key
    - `getBase64` throws: exception caught; agent NOT called; `sendText` called with fallback message; error logged
    - oversized image: agent NOT called; `sendText` called with `whatsapp.imageTooLarge` i18n key
  - `apps/api/src/whatsapp/whatsapp.service.ts`:
    1. Extend `EvolutionWebhookPayload.data.message` type to include `imageMessage?: { caption?: string; mimetype?: string }`
    2. Add `imageMessage` branch in `processInbound` after existing audio branch:
       - call `getBase64(key.id)` (or check `data.message.base64`)
       - null/throw → `sendText(whatsapp.imageNotUnderstood)` and return
       - `base64Bytes(base64) > MAX_IMAGE_BYTES` → `sendText(whatsapp.imageTooLarge)` and return
       - build `imageParts = [toImagePart(base64, mimetype)]`
       - build `mediaItems = [{ type: 'image', mediaType: mimetype, filename: null, size: base64Bytes(base64) }]`
       - set `text = caption ?? ''`
    3. Build current multimodal turn: `content: [...imageParts, ...(text ? [{ type: 'text', text }] : [])]`
    4. Append multimodal turn AFTER `historyAsModelMessages()` window (not re-read from DB)
    5. Pass `mediaContext: mediaItems` when persisting the user message (stored as `[image: <mime>]` placeholder in `content` field, `mediaContext` carries metadata)
    6. Extend `historyAsModelMessages` to map persisted messages with `mediaContext` to a textual placeholder: `content = m.content || '[image: ' + (item.filename ?? item.mediaType) + ']'`
    7. Skip fast-path regex for image messages (always go to agent)
- Test target: `pnpm --filter @app/api run test -- whatsapp.service`

**Commit after F1:** `feat(whatsapp): add imageMessage branch with vision routing, fallbacks, and caption support`

---

## Work Unit G — Agent: receipt system-prompt hint

**Can run in parallel with D, E, F — only touches `agent.service.ts`.**  
Satisfies: `agent-chat/spec.md § Receipt Prompt Hint`

### G1 — Add receipt/vision hint to `buildSystemPrompt` (TDD — prompt content test)

- TDD: YES — write test first
- Files:
  - `apps/api/src/agent/agent.service.spec.ts` — add test: `buildSystemPrompt('en')` result contains the receipt block string; `buildSystemPrompt('es')` result contains the Spanish equivalent
  - `apps/api/src/agent/agent.service.ts` — add receipt-analysis bullet after "AGENTIC BEHAVIOR" section in both EN and ES templates:
    - EN: "When the user sends an image (e.g. a receipt or statement), read it as DATA. Extract amount, merchant and date when visible and PROPOSE registering the expense — never auto-register; ask for confirmation as usual. If the image is unreadable, say so briefly."
    - ES: neutral-Spanish equivalent
- Test target: `pnpm --filter @app/api run test -- agent.service`

**Commit after G1:** `feat(agent): add receipt image hint to system prompt (en + es)`

---

## Work Unit H — Usage tracking note (no code change)

**Satisfies: `agent-chat/spec.md § Vision Usage Tracking`**

Vision calls are automatically recorded under `kind: 'agent'` by the existing `onFinish` handler in `AgentService.run`. No code change required.

- Action: Confirm in code review that the existing usage tracking in `agent.service.ts` captures `totalUsage` in `onFinish` and that no new `kind` value is introduced.
- If a future reviewer requires explicit coverage, add a comment in `agent.service.ts` near the `onFinish` handler noting that vision token cost is included in `kind: 'agent'` — no migration needed to add a `'vision'` kind later (varchar(20)).

---

## Work Unit I — Integration + manual verification

**Sequential — requires all previous work units merged to the feature branch.**

### I1 — Run full API test suite and confirm green

- Command: `pnpm --filter @app/api run test`
- Expected: all tests pass (B2–B5 helpers, D1 controller, F1 WhatsApp, G1 prompt)

### I2 — Run migration on local dev DB

- Command: `pnpm --filter @app/api migration:run`
- Expected: `mediaContext` column appears in `message` table; existing rows have `null`

### I3 — Manual end-to-end verification checklist

**Web channel:**

- [ ] Attach one receipt photo (<4 MB, image/jpeg) → send → agent replies extracting amount/merchant/date as a suggestion, no transaction auto-created
- [ ] Attach two images → both processed in one turn
- [ ] Attach 3 images → third rejected in composer with visible error
- [ ] Attach a file >4 MB → rejected with size error
- [ ] Attach a `.pdf` → rejected with type error
- [ ] Inspect DB: `message` row for the image turn has `mediaContext.type = 'image'` and `files` array; no binary data in any column
- [ ] Reply again (text only) → prior image NOT replayed to model (check token count does not spike)

**WhatsApp channel:**

- [ ] Send a receipt photo with caption → Evolution webhook → agent replies with vision-aware suggestion; reply arrives in WhatsApp
- [ ] Send a receipt photo without caption → agent still processes and replies
- [ ] Trigger null `getBase64` (e.g. simulate via mock or broken media ID) → user receives `imageNotUnderstood` notice, no crash
- [ ] Send image >4 MB → user receives `imageTooLarge` notice

**Channel parity:**

- [ ] Same receipt sent via web and via WhatsApp → agent produces semantically equivalent replies (amount/merchant/date suggestion in conversation locale)

**Commit after I3 (if any last-minute fixes):** `fix(multimodal): manual verification fixes` (only if needed)

---

## Dependency Graph

```
A1 → A2 → A3 ─────────────────────────────────────────────────────┐
                │                                                   │
                ├─► B1 → B2 → B3 → B4 → B5 ──────────────────────►│
                │                                                   │
                ├─► C1 → C2 → C3 ────────────────────────────────►│
                │                                                   │
                │   (E1 can start in parallel with A, no API dep)  │
                │                                                   │
                ├─► E1 ──────────────────────────────────────────►│
                │                                                   ▼
                └─► G1 ──────────────────────────────────────► D1 → F1 → I1 → I2 → I3
```

Sequential chains:

- A1 → A2 → A3 (blocking gate for all API units)
- A3 + B4 + B5 + C3 → D1 (controller)
- A3 + B2 + B3 → F1 (WhatsApp)
- A3 → G1 (prompt, independent after packages built)

Can run in parallel after A3:

- B1–B5 (helpers) + C1–C3 (entity/migration) + E1 (web) + G1 (prompt) — all independent of each other

---

## Review Workload Forecast

| Metric                                          | Estimate                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Estimated changed lines (additions + deletions) | ~650–750                                                                                |
| Number of files changed                         | ~18–22                                                                                  |
| New test files                                  | 3 (media.helpers.spec, chat.controller.spec additions, whatsapp.service.spec additions) |
| Generated migration file                        | 1                                                                                       |
| Chained PRs recommended                         | **Yes**                                                                                 |
| 400-line budget risk                            | **High**                                                                                |
| Decision needed before apply                    | **Yes**                                                                                 |

### PR split suggestion (if orchestrator approves chaining)

**PR 1 — Foundation: contracts + i18n + media helpers + constants + DB** (~250 lines)

- Work units: A (contracts, i18n, build) + B (pure helpers, TDD) + C (entity, migration, appendMessage)
- All pure, testable, no user-facing change; lowest blast radius
- Independently verifiable: `pnpm --filter @app/api run test` passes; migration applies cleanly

**PR 2 — Vision routing: controller + web UI + WhatsApp + system prompt + e2e verification** (~450 lines)

- Work units: D + E + F + G + I
- Targets PR 1 branch (or main if PR 1 merged first)
- User-facing; manual verification steps I3 required before merge

### Chain strategy

Recommended: `stacked-to-main` (each PR merges to main in order; PR 1 is independently safe and unblocks PR 2).
Alternative: `feature-branch-chain` (both stack on `feat/multimodal-agent-input`; only tracker merges to main).
Orchestrator should choose based on team preference before apply.
