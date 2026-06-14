# Document Input Specification

## Purpose

Defines requirements for receiving and processing document attachments (PDF, DOCX, CSV, XLSX) via server-side text extraction across the web and WhatsApp channels. Extracted text is injected as a text part into the agent turn. No binary or extracted text is persisted.

## Requirements

### Requirement: Web Document Attachment

The web chat composer MUST allow the user to attach exactly 1 document per message. The attachment button MUST accept the MIME types in `DOCUMENT_MIME_ALLOWLIST` (PDF, DOCX, CSV, XLSX). The file MUST be sent as a multipart upload to the API. The API MUST reject more than 1 document per request, files exceeding the size cap (8 MB), and MIME types not in the allowlist, using error code `chat.document_rejected` with a localized message.

#### Scenario: User attaches one valid PDF and sends with a caption

- GIVEN the chat composer is open and the attachment button is enabled
- WHEN the user selects one PDF file ≤8 MB and types a caption "summarize this statement" and sends
- THEN the file is uploaded to the API
- AND the API extracts the text layer and injects it as the first text part
- AND the caption becomes a second text part
- AND the agent receives both parts and replies with a summary in the conversation locale

#### Scenario: User attaches one valid DOCX and sends

- GIVEN the chat composer is open
- WHEN the user selects a DOCX file ≤8 MB and sends
- THEN the API extracts the document body text and injects it into the agent turn
- AND the agent responds to the document content

#### Scenario: User attaches a CSV and sends

- GIVEN the chat composer is open
- WHEN the user selects a CSV file ≤8 MB and sends
- THEN the API parses the CSV and serializes it as readable rows (e.g. pipe-delimited text or markdown table)
- AND the serialized rows are injected as the text part
- AND the agent reads and summarizes the rows

#### Scenario: User attaches an XLSX and sends

- GIVEN the chat composer is open
- WHEN the user selects an XLSX file ≤8 MB and sends
- THEN the API parses the first sheet and serializes rows to readable text
- AND the serialized rows are injected as the text part
- AND the agent reads and summarizes the rows

#### Scenario: User attaches more than 1 document

- GIVEN the chat composer is open
- WHEN the user attempts to send more than 1 document attachment
- THEN the API MUST reject the request with `chat.document_rejected` and HTTP 422
- AND no extraction or agent call is made

#### Scenario: User attaches a file exceeding 8 MB

- GIVEN the chat composer is open
- WHEN the user selects a file larger than 8 MB
- THEN the API MUST reject the request with `chat.document_rejected`
- AND no extraction or agent call is made

#### Scenario: User attaches an unsupported MIME type

- GIVEN the chat composer is open
- WHEN the user selects a file whose MIME type is not in `DOCUMENT_MIME_ALLOWLIST`
- THEN the API MUST reject the request with `chat.document_rejected`
- AND no extraction or agent call is made

---

### Requirement: Per-Format Text Extraction

The server MUST extract plain text from each supported format using the following rules:

| Format | Extraction rule                                                                         |
| ------ | --------------------------------------------------------------------------------------- |
| PDF    | Text layer only (no OCR); truncate at PDF page cap (30 pages) with a notice if exceeded |
| DOCX   | Body paragraphs; ignore embedded images and charts                                      |
| CSV    | All rows serialized as readable text (column header + data rows)                        |
| XLSX   | First sheet only; rows serialized as readable text; ignore other sheets                 |

Extraction MUST be performed in-memory. No file is written to disk. Malformed or corrupt files MUST be caught and treated as extraction failures (see Extraction Failure requirement). Extracted text MUST be truncated to 40 000 chars with a visible notice appended if exceeded.

#### Scenario: PDF text extraction — within page cap

- GIVEN a PDF with 10 pages and a text layer
- WHEN the API extracts the text
- THEN the full text of all 10 pages is returned
- AND the result is under 40 000 chars (not truncated)

#### Scenario: PDF exceeds page cap — truncation with notice

- GIVEN a PDF with 45 pages
- WHEN the API extracts the text
- THEN only the first 30 pages are processed
- AND the extracted text includes a notice that the document was truncated at 30 pages

#### Scenario: Extracted text exceeds char cap

- GIVEN a document whose full extracted text exceeds 40 000 chars
- WHEN the API applies the char cap
- THEN the injected text is truncated at 40 000 chars
- AND a notice is appended indicating the text was truncated for processing

#### Scenario: CSV serialized as readable rows

- GIVEN a CSV file with a header row and N data rows
- WHEN the API parses and serializes the CSV
- THEN the extracted text includes the header and all data rows in a human-readable format
- AND column alignment is sufficient for the model to distinguish columns

#### Scenario: XLSX first sheet serialized

- GIVEN an XLSX file with multiple sheets
- WHEN the API parses the file
- THEN only the first sheet is extracted
- AND rows are serialized as readable text in the same format as CSV

---

### Requirement: Empty/Low-Text Detection (Scanned PDF)

When extracted text from a document is empty or below a minimum viable length (fewer than 50 non-whitespace characters), the system MUST NOT call the model. The system MUST return a localized message to the user indicating the document could not be read as text and that OCR is not supported.

#### Scenario: Scanned PDF yields no extractable text

- GIVEN a PDF whose pages are image-only (scanned document)
- WHEN the API attempts text extraction
- THEN the extracted text is empty or below threshold
- AND the API returns a user-facing message: document cannot be read as text, OCR is not supported
- AND no agent call is made

#### Scenario: PDF with minimal text (sparse pages)

- GIVEN a PDF with only a few non-whitespace characters (e.g. a header-only document)
- WHEN extracted text is below 50 non-whitespace characters
- THEN the API treats it as low-text and applies the same no-model-call path

---

### Requirement: Extraction Failure Handling

If text extraction throws an exception (malformed file, corrupt archive, unsupported internal structure), the system MUST catch the error, MUST NOT crash, and MUST return a localized error message to the user. No agent call is made.

#### Scenario: Malformed DOCX causes extraction error

- GIVEN a file with a `.docx` extension that has a corrupted internal structure
- WHEN the API attempts extraction
- THEN the exception is caught
- AND the user receives a localized error message (e.g. "Could not process this document")
- AND no agent call is made
- AND the error is logged for observability

#### Scenario: Malformed XLSX causes extraction error

- GIVEN a file with a `.xlsx` extension with a corrupted ZIP structure
- WHEN the API attempts extraction
- THEN the exception is caught
- AND a graceful error message is returned to the user

---

### Requirement: WhatsApp Document Receive

The WhatsApp service MUST handle inbound `documentMessage` events by retrieving the binary via `getBase64()`, identifying the MIME type from the message metadata, extracting text server-side, and passing the extracted text to the agent. The caption (if present) MUST become the user's text prompt. The agent's reply MUST be sent back to the originating WhatsApp number. The `documentMessage` branch MUST mirror the `imageMessage` branch structure.

#### Scenario: Inbound PDF with caption

- GIVEN a WhatsApp user sends a PDF `documentMessage` with caption "what are my expenses?"
- WHEN the event is received
- THEN `getBase64()` is called to retrieve the binary
- AND the API extracts the PDF text layer
- AND the caption becomes the user text part
- AND the agent reply is sent back to the user via WhatsApp

#### Scenario: Inbound document without caption

- GIVEN a WhatsApp user sends a documentMessage with no caption
- WHEN the event is received
- THEN the extracted text is the only content in the agent input
- AND the agent reply is sent back to the user

#### Scenario: getBase64 returns null for document

- GIVEN a WhatsApp documentMessage is received
- WHEN `getBase64()` returns `null`
- THEN the service MUST NOT crash
- AND a graceful text-only fallback reply is sent to the user

#### Scenario: getBase64 throws for document

- GIVEN a WhatsApp documentMessage is received
- WHEN `getBase64()` throws an error
- THEN the exception is caught
- AND a graceful fallback reply is sent to the user
- AND the error is logged

#### Scenario: WhatsApp document with unsupported MIME type

- GIVEN a WhatsApp user sends a documentMessage with MIME type not in `DOCUMENT_MIME_ALLOWLIST`
- WHEN the event is received
- THEN the service sends a user-facing message that the file type is not supported
- AND no agent call is made

---

### Requirement: Document mediaContext Persistence

When a document message is processed, the system MUST persist a `mediaContext` entry with `type: 'document'` and document metadata. The system MUST NOT persist the document binary or the extracted text. Only metadata is stored.

#### Scenario: Document message mediaContext saved

- GIVEN a message with one document attachment is processed
- WHEN the message is saved to the database
- THEN `mediaContext` contains `type: "document"` and a `files` entry with `filename`, `size`, `mime`, and optionally `pageCount`
- AND no binary data or extracted text appears in the `Message` row

#### Scenario: Text-only message still yields null mediaContext

- GIVEN a message with no attachments
- WHEN the message is saved
- THEN `mediaContext` is `null` (backward-compatible)

---

### Requirement: Document History Replay Strip

When replaying conversation history to the model, the agent MUST strip document-injected text parts from past turns. A placeholder note MUST replace each stripped document part to preserve conversational context without re-injecting document text tokens.

#### Scenario: History replay with past document turn

- GIVEN a conversation where a previous turn included a document text injection
- WHEN the agent compiles history for a new model call
- THEN the extracted text is removed from the prior turn
- AND a short placeholder (e.g. "[document attached: statement.pdf]") replaces it
- AND the current turn's document text is NOT stripped

---

### Requirement: New Error Code — chat.document_rejected

The error code `chat.document_rejected` MUST be added to the shared error-codes contract. English and Spanish translations MUST be added to the i18n locale files and MUST pass the `TS1360` type-gate.

#### Scenario: Error code exists and is translated

- GIVEN the `chat.document_rejected` error code is defined
- WHEN the API rejects a document
- THEN the response includes the error code
- AND the message is in the request locale (EN or ES)

---

### Requirement: Non-Goals (Slice 2)

The following MUST NOT be implemented as part of this change:

- OCR or scanned-PDF processing (deferred to Slice 3).
- Object/file storage (S3, MinIO, local disk) of document binaries.
- Persistence of extracted text in the database or conversation history.
- Embedded images, charts, or rich layout fidelity inside documents.
- Multi-sheet XLSX extraction (first sheet only).
- Automatic transaction creation without user confirmation.
- XLSX support deferral: if XLSX complexity exceeds time budget, it MAY be deferred to Slice 2b without breaking other formats.
