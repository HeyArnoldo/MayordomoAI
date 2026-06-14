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

## Remaining for PR2

- [ ] D1 — Chat controller: validateImageParts + stripImagesFromHistory + persist mediaContext
- [ ] E1 — Web UI: enable attachment button + file wiring + blob-failure guard
- [ ] F1 — WhatsApp: imageMessage branch + payload type + fallbacks
- [ ] G1 — Agent: receipt system-prompt hint (en + es)
- [ ] I1–I3 — Integration + manual verification
