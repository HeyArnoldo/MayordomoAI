import { HttpStatus } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ChatController } from './chat.controller';

// Minimal stubs for dependencies not under test.
const makeConversationsService = () => ({
  ensureWhatsAppThread: jest.fn(),
  list: jest.fn(),
  create: jest.fn(),
  rename: jest.fn(),
  togglePin: jest.fn(),
  remove: jest.fn(),
  listMessages: jest.fn(),
  findOne: jest.fn(),
  lastMessage: jest.fn(),
  appendMessage: jest.fn(),
  setTitle: jest.fn(),
});

const makeAgentService = () => ({
  run: jest.fn(),
  suggestTitle: jest.fn(),
});

const makeTranscriptionService = () => ({
  transcribe: jest.fn(),
});

const makeUser = () => ({
  id: 'u1',
  name: 'Test User',
  language: 'es' as const,
  currency: 'PEN',
});

describe('ChatController', () => {
  let controller: ChatController;
  let conversations: ReturnType<typeof makeConversationsService>;
  let agent: ReturnType<typeof makeAgentService>;
  let transcription: ReturnType<typeof makeTranscriptionService>;

  beforeEach(() => {
    conversations = makeConversationsService();
    agent = makeAgentService();
    transcription = makeTranscriptionService();
    controller = new ChatController(conversations as never, agent as never, transcription as never);
  });

  describe('transcribe', () => {
    describe('when no audio file is provided', () => {
      it('throws AppException with code chat.audio_missing', async () => {
        const user = makeUser();
        await expect(controller.transcribe(user as never, undefined)).rejects.toMatchObject({
          code: 'chat.audio_missing',
        });
      });

      it('thrown exception has BAD_REQUEST status', async () => {
        const user = makeUser();
        let caught: { getStatus: () => number } | undefined;
        try {
          await controller.transcribe(user as never, undefined);
        } catch (e) {
          caught = e as typeof caught;
        }
        expect(caught?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      });

      it('throws AppException (not a plain BadRequestException)', async () => {
        const user = makeUser();
        let caught: unknown;
        try {
          await controller.transcribe(user as never, undefined);
        } catch (e) {
          caught = e;
        }
        expect(caught).toBeInstanceOf(AppException);
      });
    });

    describe('when audio file has empty buffer', () => {
      it('throws AppException with code chat.audio_missing', async () => {
        const user = makeUser();
        const file = { buffer: Buffer.alloc(0), mimetype: 'audio/webm', size: 0 };
        await expect(controller.transcribe(user as never, file as never)).rejects.toMatchObject({
          code: 'chat.audio_missing',
        });
      });
    });

    describe('when transcription returns null', () => {
      it('throws AppException with code chat.transcription_failed', async () => {
        const user = makeUser();
        const file = { buffer: Buffer.from('audio'), mimetype: 'audio/webm', size: 5 };
        transcription.transcribe.mockResolvedValue(null);
        await expect(controller.transcribe(user as never, file as never)).rejects.toMatchObject({
          code: 'chat.transcription_failed',
        });
      });

      it('thrown exception has BAD_REQUEST status', async () => {
        const user = makeUser();
        const file = { buffer: Buffer.from('audio'), mimetype: 'audio/webm', size: 5 };
        transcription.transcribe.mockResolvedValue(null);
        let caught: { getStatus: () => number } | undefined;
        try {
          await controller.transcribe(user as never, file as never);
        } catch (e) {
          caught = e as typeof caught;
        }
        expect(caught?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      });

      it('throws AppException (not a plain BadRequestException)', async () => {
        const user = makeUser();
        const file = { buffer: Buffer.from('audio'), mimetype: 'audio/webm', size: 5 };
        transcription.transcribe.mockResolvedValue(null);
        let caught: unknown;
        try {
          await controller.transcribe(user as never, file as never);
        } catch (e) {
          caught = e;
        }
        expect(caught).toBeInstanceOf(AppException);
      });
    });

    describe('when transcription succeeds', () => {
      it('returns the transcribed text', async () => {
        const user = makeUser();
        const file = { buffer: Buffer.from('audio'), mimetype: 'audio/webm', size: 5 };
        transcription.transcribe.mockResolvedValue('hello world');
        const result = await controller.transcribe(user as never, file as never);
        expect(result).toEqual({ text: 'hello world' });
      });
    });
  });
});
