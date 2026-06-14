# Delta for Multimodal Input

## ADDED Requirements

### Requirement: Document MIME Allowlist

The system MUST define a `DOCUMENT_MIME_ALLOWLIST` constant containing the accepted MIME types for document attachments: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX), `text/csv`, and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX). Any file whose MIME type is not in this list MUST be rejected with `chat.document_rejected`.

#### Scenario: Allowlisted MIME type is accepted

- GIVEN a file upload with MIME type `application/pdf`
- WHEN the API validates the MIME type against `DOCUMENT_MIME_ALLOWLIST`
- THEN the file passes MIME validation and proceeds to extraction

#### Scenario: Non-allowlisted MIME type is rejected

- GIVEN a file upload with MIME type `application/zip`
- WHEN the API validates the MIME type
- THEN the request is rejected with `chat.document_rejected`

---

### Requirement: Document Guardrail Constants

The system MUST define the following guardrail constants: max document file size (8 MB), max PDF pages before truncation (30), max extracted-text chars before truncation (40 000). These constants MUST be co-located with the existing image guardrail constants (e.g. in `media.constants.ts`).

#### Scenario: Constants are accessible to validators and extractors

- GIVEN the document guardrail constants are defined
- WHEN `validateDocumentParts` and `extractDocumentText` reference them
- THEN each function uses the same constant values (no hardcoded literals in logic)

---

## MODIFIED Requirements

### Requirement: Vision Cost Control — History Strip

When replaying conversation history to the model, the agent MUST strip image binary parts AND document-injected text parts from past turns. A textual note MUST replace each stripped part to preserve conversational context without re-submitting image or document tokens.
(Previously: strip applied to image parts only.)

#### Scenario: History replay with past image messages

- GIVEN a conversation where a previous turn contained an image part
- WHEN the agent compiles history for the next model call
- THEN all image binary/data-URL parts from prior turns are removed
- AND each removed image is replaced by a short textual placeholder (e.g. "[image attached]")
- AND the current turn's image parts are NOT stripped

#### Scenario: History replay with past document turns

- GIVEN a conversation where a previous turn included a document text injection
- WHEN the agent compiles history for the next model call
- THEN the extracted document text is removed from the prior turn
- AND a short placeholder (e.g. "[document attached: statement.pdf]") replaces it
- AND the current turn's document text is NOT stripped

#### Scenario: Mixed history — image and document turns

- GIVEN a conversation with one prior image turn and one prior document turn
- WHEN the agent compiles history
- THEN both the image part and the document text are stripped from their respective turns
- AND both are replaced with appropriate placeholders
- AND the current turn is unaffected

---

### Requirement: Non-Goals (Slice 1)

The following MUST NOT be implemented as part of this change:

- Object or file storage (no S3, MinIO, or local disk writes of image binaries).
- Image binary persistence in the database.
- Image binary replay in conversation history.
- Native audio model or audio-native processing (audio already works; no change required).
- Video, stickers, or GIF processing.
- Automatic transaction creation without explicit user confirmation.

(Previously: included "Document types: PDF, DOCX, CSV, Excel (deferred to Slice 2)" as a non-goal. That item is REMOVED now that Slice 2 implements it. All other non-goals remain.)
