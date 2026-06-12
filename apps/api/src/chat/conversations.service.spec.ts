import { HttpStatus } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { Conversation } from './conversation.entity';
import { Channel } from '@app/contracts';

const makeConv = (overrides: Partial<Conversation> = {}): Conversation =>
  ({
    id: 'c1',
    userId: 'u1',
    channel: Channel.WEB,
    title: 'Test',
    isSystem: false,
    pinned: false,
    lastAt: new Date(),
    ...overrides,
  }) as Conversation;

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
});

const makeMessagesRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

describe('ConversationsService', () => {
  let service: ConversationsService;
  let conversations: ReturnType<typeof makeRepo>;
  let messages: ReturnType<typeof makeMessagesRepo>;

  beforeEach(() => {
    conversations = makeRepo();
    messages = makeMessagesRepo();
    service = new ConversationsService(conversations as never, messages as never);
  });

  describe('findOne', () => {
    it('throws conversation.not_found when conversation does not exist', async () => {
      conversations.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'c1')).rejects.toMatchObject({
        code: 'conversation.not_found',
      });
    });

    it('thrown exception has NOT_FOUND status', async () => {
      conversations.findOne.mockResolvedValue(null);
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.findOne('u1', 'c1');
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('rename', () => {
    it('throws conversation.whatsapp_thread_rename_forbidden for system conversations', async () => {
      conversations.findOne.mockResolvedValue(makeConv({ isSystem: true }));
      await expect(service.rename('u1', 'c1', 'new title')).rejects.toMatchObject({
        code: 'conversation.whatsapp_thread_rename_forbidden',
      });
    });

    it('thrown exception has BAD_REQUEST status', async () => {
      conversations.findOne.mockResolvedValue(makeConv({ isSystem: true }));
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.rename('u1', 'c1', 'new title');
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('remove', () => {
    it('throws conversation.whatsapp_thread_delete_forbidden for system conversations', async () => {
      conversations.findOne.mockResolvedValue(makeConv({ isSystem: true }));
      await expect(service.remove('u1', 'c1')).rejects.toMatchObject({
        code: 'conversation.whatsapp_thread_delete_forbidden',
      });
    });

    it('thrown exception has BAD_REQUEST status', async () => {
      conversations.findOne.mockResolvedValue(makeConv({ isSystem: true }));
      let caught: { getStatus: () => number } | undefined;
      try {
        await service.remove('u1', 'c1');
      } catch (e) {
        caught = e as typeof caught;
      }
      expect(caught?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });
});
