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
