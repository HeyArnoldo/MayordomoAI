# Delta for Agent Chat

## ADDED Requirements

### Requirement: Document Text Parts in Agent Turn

The agent service MUST accept message payloads that include an extracted-document text part in addition to the optional user caption/text part. The extracted text MUST be the first text part in the turn, labeled with the filename (e.g. `[Document: statement.pdf]\n{extracted text}`). The user caption/prompt (if any) MUST be the second text part. The agent MUST respond in the conversation locale regardless of document content language. No native AI-SDK file part is used — injection is plain text only.

#### Scenario: Agent receives a bank statement PDF with caption

- GIVEN a message payload containing extracted PDF text (labeled with filename) and a caption "list my transactions"
- WHEN the agent processes the turn
- THEN `streamText` receives the extracted text as the first part and the caption as the second part
- AND the model identifies amounts, dates, and merchants from the text
- AND the reply is in the conversation locale

#### Scenario: Agent receives a CSV document with no caption

- GIVEN a message payload containing extracted CSV row text and no caption
- WHEN the agent processes the turn
- THEN `streamText` receives only the extracted text part
- AND the model summarizes or analyses the tabular data
- AND the reply is in the conversation locale

#### Scenario: Agent receives a DOCX and offers to register transactions

- GIVEN a message payload containing DOCX body text describing expenses
- WHEN the agent processes the turn
- THEN the model identifies relevant financial items
- AND presents them as suggestions for the user to confirm before any register tool is invoked
- AND no transaction is registered automatically

---

### Requirement: Document mediaContext in messageSchema Contract

The shared `messageSchema` (in `packages/contracts`) MUST extend the existing `mediaContext` field to allow `type: 'document'` in addition to `type: 'image'`. The `files` entry for a document MUST include `filename`, `size`, `mime`, and an optional `pageCount`. Existing image messages and text-only messages MUST continue to pass schema validation without modification.

#### Scenario: Schema accepts document mediaContext

- GIVEN a message object with `mediaContext: { type: "document", files: [{ filename: "statement.pdf", size: 204800, mime: "application/pdf", pageCount: 5 }] }`
- WHEN the object is validated against `messageSchema`
- THEN validation passes

#### Scenario: Schema accepts document mediaContext without pageCount

- GIVEN a message object where the `files` entry omits `pageCount` (e.g. for DOCX)
- WHEN the object is validated against `messageSchema`
- THEN validation passes (pageCount is optional)

#### Scenario: Schema still accepts image mediaContext (backward compatible)

- GIVEN a message object with `mediaContext: { type: "image", files: [...] }`
- WHEN the object is validated against `messageSchema`
- THEN validation passes without changes

#### Scenario: Schema still accepts text-only message (backward compatible)

- GIVEN a message object with no `mediaContext` field
- WHEN the object is validated against `messageSchema`
- THEN validation passes without errors

---

## MODIFIED Requirements

### Requirement: mediaContext Metadata Persistence

The `Message` entity MUST include a nullable `mediaContext` JSONB column. When a message carries image attachments, the controller MUST persist `mediaContext` with `type: "image"`. When a message carries a document attachment, the controller MUST persist `mediaContext` with `type: "document"`, `filename`, `size`, `mime`, and optionally `pageCount`. The system MUST NOT persist the document binary or the extracted text. `mediaContext` MUST be `null` for text-only messages.
(Previously: only `type: "image"` was defined for mediaContext; document type is now added.)

#### Scenario: Image message persisted

- GIVEN a message with one image attachment is processed successfully
- WHEN the message is saved to the database
- THEN `mediaContext` contains `type: "image"` and one entry in `files` with filename, size, and mime
- AND no image binary data appears anywhere in the `Message` row

#### Scenario: Document message persisted

- GIVEN a message with one document attachment is processed successfully
- WHEN the message is saved to the database
- THEN `mediaContext` contains `type: "document"` and one entry in `files` with filename, size, mime, and (where applicable) pageCount
- AND no binary data or extracted text appears in the `Message` row

#### Scenario: Text-only message persisted

- GIVEN a message with no attachments
- WHEN the message is saved to the database
- THEN `mediaContext` is `null`
- AND the rest of the message fields are unchanged (backward compatibility)

#### Scenario: Multiple images persisted

- GIVEN a message with two image attachments
- WHEN the message is saved to the database
- THEN `mediaContext.files` has exactly two entries, one per image
