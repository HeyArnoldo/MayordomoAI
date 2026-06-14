# Multimodal Input Specification

## Purpose

Defines requirements for receiving and interpreting image attachments through the agent across the web and WhatsApp channels, including channel-parity contract, validation guardrails, and cost controls.

## Requirements

### Requirement: Web Image Attachment

The web chat composer MUST allow the user to attach up to 2 images per message via the attachment button (previously disabled). The button MUST accept only `image/*` MIME types. Each image MUST be converted from a `Blob` to a `data-URL` before inclusion in the message payload. Conversion failures MUST surface a visible error in the composer and MUST NOT silently drop the file.

#### Scenario: User attaches one valid image and sends

- GIVEN the chat composer is open and the attachment button is enabled
- WHEN the user selects one image file ≤4 MB with an `image/*` MIME type and sends
- THEN the message payload includes one image part as a base64 data-URL alongside any text
- AND the request reaches the agent with the image part intact
- AND the agent produces a vision-aware reply in the conversation locale

#### Scenario: User attaches two valid images and sends

- GIVEN the chat composer is open
- WHEN the user selects two image files each ≤4 MB with `image/*` MIME types and sends
- THEN both image parts are included in the message payload
- AND the agent receives and processes both images in a single turn

#### Scenario: User attaches more than two images

- GIVEN the chat composer is open
- WHEN the user attempts to attach more than 2 images
- THEN the composer MUST reject the excess files with a user-visible validation error
- AND MUST NOT send any images beyond the two-image limit

#### Scenario: User attaches an image exceeding 4 MB

- GIVEN the chat composer is open
- WHEN the user selects an image file larger than 4 MB
- THEN the composer MUST reject the file with a size-limit error message
- AND MUST NOT include the oversized image in the payload

#### Scenario: User attaches a non-image file type

- GIVEN the chat composer is open
- WHEN the user selects a file whose MIME type is not `image/*`
- THEN the composer MUST reject the file with a type-restriction error message
- AND MUST NOT include it in the payload

#### Scenario: Blob-to-dataURL conversion fails

- GIVEN the user has selected a valid image file
- WHEN the `FileReader` or equivalent conversion mechanism throws or returns an error
- THEN the composer MUST display an error message to the user
- AND MUST NOT silently drop the file or proceed with a broken payload

---

### Requirement: WhatsApp Image Receive

The WhatsApp service MUST handle inbound `imageMessage` events by downloading the image binary via `getBase64()`, converting it to a data-URL, and passing it as an image part to the agent. When the inbound message includes a caption, the caption MUST become the text part of the agent turn. The agent's reply MUST be sent back to the originating WhatsApp number.

#### Scenario: Inbound image with caption

- GIVEN a WhatsApp user sends an image message with a non-empty caption
- WHEN the `imageMessage` event is received
- THEN `getBase64()` is called to retrieve the binary
- AND the caption text becomes the text part of the agent input
- AND the image data-URL becomes the image part of the agent input
- AND the agent reply is sent back to the user via WhatsApp

#### Scenario: Inbound image without caption

- GIVEN a WhatsApp user sends an image message with no caption
- WHEN the `imageMessage` event is received
- THEN `getBase64()` is called to retrieve the binary
- AND the agent input contains only the image part (no text part)
- AND the agent reply is sent back to the user via WhatsApp

#### Scenario: getBase64 returns null

- GIVEN a WhatsApp user sends an image message
- WHEN `getBase64()` returns `null`
- THEN the service MUST NOT crash or throw an unhandled exception
- AND MUST send a graceful text-only fallback reply to the user indicating the image could not be processed

#### Scenario: getBase64 throws an error

- GIVEN a WhatsApp user sends an image message
- WHEN `getBase64()` throws an error
- THEN the exception MUST be caught
- AND a graceful text-only fallback reply MUST be sent to the user
- AND the error MUST be logged for observability

---

### Requirement: Channel Parity

The agent MUST receive structurally identical input (image parts + optional text part) regardless of whether the message originated from the web UI or WhatsApp. No channel-specific image handling logic MUST leak into the agent layer.

#### Scenario: Same receipt photo sent via web and via WhatsApp

- GIVEN the same image is sent through both channels
- WHEN the agent service processes each message
- THEN the model input shape (image part + text part) is equivalent for both
- AND the agent produces semantically equivalent replies for both

---

### Requirement: Vision Cost Control — History Strip

When replaying conversation history to the model, the agent MUST strip image binary parts from past turns. A textual note MUST replace each stripped image part to preserve conversational context without re-submitting image tokens.

#### Scenario: History replay with past image messages

- GIVEN a conversation where a previous turn contained an image part
- WHEN the agent compiles history for the next model call
- THEN all image binary/data-URL parts from prior turns are removed
- AND each removed image is replaced by a short textual placeholder (e.g. "[image attached]")
- AND the current turn's image parts are NOT stripped

---

### Requirement: Non-Goals (Slice 1)

The following MUST NOT be implemented as part of this change:

- Object or file storage (no S3, MinIO, or local disk writes of image binaries).
- Image binary persistence in the database.
- Image binary replay in conversation history.
- Document types: PDF, DOCX, CSV, Excel (deferred to Slice 2).
- Native audio model or audio-native processing (audio already works; no change required).
- Video, stickers, or GIF processing.
- Automatic transaction creation without explicit user confirmation.
