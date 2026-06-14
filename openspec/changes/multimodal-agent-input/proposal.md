# Proposal: Multimodal Agent Input (Images now, Documents next)

## Intent

The mayordomo is a personal-finance butler. Logging an expense today still
requires typing it. Users naturally have a **receipt photo**, a **voice note**, or
a **statement** — not pre-parsed text. We want the agent to _see_ a receipt and
help register the transaction (amount, merchant, date). Audio already works in
both channels; the missing primitive is **vision**. This change ships image
understanding on web AND WhatsApp, with documents as a follow-up slice.

## Scope

### In Scope (Slice 1 — this change, the shippable MVP)

- **Web**: wire `message.files` into `sendMessage`; enable the disabled `Plus`
  attach button (`accept=image/*`, max 2 images, ~4MB each).
- **WhatsApp**: add an `imageMessage` branch mirroring the existing audio path
  (`getBase64()` → data-URL → gpt-4o vision); keep image caption as the text part.
- Pass image parts to `streamText` (gpt-4o already supports them via
  `convertToModelMessages`).
- Add nullable `mediaContext` JSONB column to `Message` (metadata only:
  type/filename/size/mime — NOT the binary) + extend `messageSchema` (contracts).
- Receipt system-prompt hint; guardrails: size/count caps, strip images from
  replayed history.

### Out of Scope (Slice 1 non-goals)

- Object/file storage (no S3/MinIO/local); images are **ephemeral**.
- Image history replay (stripped from past turns to control vision cost).
- Documents (PDF/DOCX/CSV/Excel) — deferred to Slice 2.
- Native audio model, video, stickers, GIFs.
- Auto-creating transactions without user confirmation.

### Slice 2 (follow-up change, not this one)

PDF + DOCX text extraction (`pdf-parse`, `mammoth`) and CSV injected as text;
Excel (`xlsx`) and optional attachment storage later.

## Capabilities

### New Capabilities

- `multimodal-input`: receiving and interpreting image attachments through the
  agent across web and WhatsApp, including channel-parity contract and guardrails.

### Modified Capabilities

- `agent-chat`: messages may now carry image parts and `mediaContext` metadata;
  history replay strips image binaries.

## Approach

Inline **base64/data-URL → gpt-4o vision**, ephemeral. No new infra. Channel
parity is the contract: identical model input regardless of source channel.
Receipts get a **free-form vision response** (extract amount/merchant/date as a
suggestion) and the user confirms before any existing financial tool registers
the transaction — no new `analyzeReceipt` tool in Slice 1. The reply language
follows the conversation locale (i18n).

## Affected Areas

| Area                                             | Impact   | Description                                             |
| ------------------------------------------------ | -------- | ------------------------------------------------------- |
| `apps/web/.../chat/chat-thread.tsx`              | Modified | Send files; enable Plus button + accept/limits          |
| `apps/api/src/whatsapp/whatsapp.service.ts`      | Modified | `imageMessage` branch; type payload; caption handling   |
| `apps/api/src/agent/agent.service.ts`            | Modified | Receipt prompt hint; strip images from replayed history |
| `apps/api/src/.../message.entity.ts` + migration | New      | Nullable `mediaContext` JSONB                           |
| `packages/contracts`                             | Modified | `messageSchema` gains `mediaContext`                    |
| `apps/api/.../chat.controller.ts`                | Modified | Persist `mediaContext` metadata (not binary)            |

## Risks

| Risk                                                | Likelihood | Mitigation                                         |
| --------------------------------------------------- | ---------- | -------------------------------------------------- |
| Vision token cost grows across history              | High       | Strip image parts from replayed turns              |
| Evolution `getBase64()` unreliable (undocumented)   | Med        | Null-check; fall back to text-only with notice     |
| Node memory pressure on Coolify (concurrent base64) | Med        | Hard size/count caps; reject oversized early       |
| Web blob→dataURL silent failure                     | Med        | Validate conversion; surface error in composer     |
| WhatsApp image may carry caption + mimetype         | Med        | Treat caption as text part; pass mimetype to model |

## Rollback Plan

Slice 1 is feature-branch-only (default `main` auto-deploys to Coolify). Revert
the feature branch; web Plus button returns to disabled placeholder. The
`mediaContext` column is nullable and additive — safe to leave; if reverting the
schema, a down-migration drops the unused nullable column with no data loss.

## Dependencies

- gpt-4o multimodal over Azure OpenAI (already configured).
- Evolution API `getBase64()` for WhatsApp media (already used for audio).

## Assumptions (AUTOMATIC mode — chosen defaults)

- Receipt handling = **vision response + user-confirmed register**, NOT a
  structured `analyzeReceipt` tool (lower scope, reuses existing financial tools).
- **Max 2 images / message, ~4MB each**; oversized rejected with a friendly message.
- Images are **ephemeral**: only `mediaContext` metadata persisted, never the binary.
- Reply **language follows conversation locale** (existing i18n), not image content.
- WhatsApp **caption** (if present) becomes the text part of the message.
- Audio needs **no work** — verify-only in a later phase.

## Success Criteria

- [ ] User sends a receipt photo on web → agent extracts amount/merchant/date and offers to register.
- [ ] User sends a receipt photo on WhatsApp → same behavior (channel parity).
- [ ] Oversized / too-many images rejected gracefully in both channels.
- [ ] `mediaContext` persisted as metadata; no binary stored anywhere.
- [ ] Replayed history contains no image binaries (cost guardrail verified).
