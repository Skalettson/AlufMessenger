import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BotService } from '../bot.service';

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

const mockRedis = {
  llen: vi.fn().mockResolvedValue(0),
  lrange: vi.fn().mockResolvedValue([]),
  ltrim: vi.fn().mockResolvedValue('OK'),
  rpush: vi.fn().mockResolvedValue(1),
};

const mockNats = {
  publish: vi.fn(),
  subscribe: vi.fn().mockReturnValue({
    [Symbol.asyncIterator]: () => ({
      next: () => new Promise(() => {}),
    }),
  }),
};

const mockWebhookService = {
  deliverUpdate: vi.fn().mockResolvedValue(undefined),
};

const sampleBot = {
  id: 'bot-1',
  ownerId: 'owner-1',
  token: 'bot-token-123',
  webhookUrl: null,
  isInline: false,
  commands: [{ command: 'start', description: 'Start the bot' }],
  description: 'A test bot',
};

const sampleBotUser = {
  id: 'bot-1',
  username: 'testbot',
  displayName: 'Test Bot',
  avatarUrl: null,
  isBot: true,
};

describe('BotService', () => {
  let service: BotService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();

    const mockMessageClient = { getService: () => ({}) };
    const mockChatClient = { getService: () => ({}) };
    service = new BotService(
      mockDb as any,
      mockRedis as any,
      mockNats as any,
      mockMessageClient as any,
      mockChatClient as any,
      mockWebhookService as any,
    );
  });

  describe('validateBotToken', () => {
    it('should return bot when token is valid', async () => {
      mockDb.limit.mockResolvedValueOnce([sampleBot]);

      const result = await service.validateBotToken('bot-token-123');

      expect(result.id).toBe('bot-1');
      expect(result.token).toBe('bot-token-123');
    });

    it('should throw for invalid token', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.validateBotToken('bad-token'),
      ).rejects.toThrow('Invalid bot token');
    });
  });

  describe('getMe', () => {
    it('should return bot profile with commands', async () => {
      mockDb.limit
        .mockResolvedValueOnce([sampleBotUser])
        .mockResolvedValueOnce([{ description: 'A test bot', commands: sampleBot.commands }]);

      const result = await service.getMe('bot-1');

      expect(result.id).toBe('bot-1');
      expect(result.is_bot).toBe(true);
      expect(result.username).toBe('testbot');
      expect(result.commands).toHaveLength(1);
    });

    it('should throw when bot user not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.getMe('nonexistent'),
      ).rejects.toThrow('Bot');
    });
  });

  describe('sendMessage', () => {
    it('should publish message via NATS and return result', async () => {
      const result = await service.sendMessage('bot-1', 'chat-1', 'Hello from bot');

      expect(result.chat_id).toBe('chat-1');
      expect(result.text).toBe('Hello from bot');
      expect(result.from.is_bot).toBe(true);
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should throw for empty message text', async () => {
      await expect(
        service.sendMessage('bot-1', 'chat-1', '   '),
      ).rejects.toThrow('Message text is required');
    });

    it('should include reply markup in metadata', async () => {
      const markup = { inline_keyboard: [[{ text: 'Click', callback_data: 'action' }]] };

      await service.sendMessage('bot-1', 'chat-1', 'Pick one', markup);

      const publishCall = mockNats.publish.mock.calls[0];
      const payload = JSON.parse(new TextDecoder().decode(publishCall[1]));
      expect(payload.metadata.replyMarkup).toEqual(markup);
    });
  });

  describe('getUpdates', () => {
    it('should return empty array when no updates', async () => {
      const result = await service.getUpdates('bot-1', 0, 10, 0);

      expect(result).toEqual([]);
    });

    it('should parse and return queued updates', async () => {
      mockRedis.lrange.mockResolvedValueOnce([
        JSON.stringify({ updateId: 1, message: { text: 'hi' } }),
        JSON.stringify({ updateId: 2, message: { text: 'hello' } }),
      ]);

      const result = await service.getUpdates('bot-1', 0, 10, 0);

      expect(result).toHaveLength(2);
      expect(result[0].updateId).toBe(1);
    });

    it('should filter by offset and trim queue', async () => {
      mockRedis.lrange.mockResolvedValueOnce([
        JSON.stringify({ updateId: 1, message: { text: 'old' } }),
        JSON.stringify({ updateId: 5, message: { text: 'new' } }),
      ]);

      const result = await service.getUpdates('bot-1', 5, 10, 0);

      expect(result).toHaveLength(1);
      expect(result[0].updateId).toBe(5);
      expect(mockRedis.ltrim).toHaveBeenCalled();
    });

    it('should clamp limit to maximum 100', async () => {
      mockRedis.lrange.mockResolvedValueOnce([]);

      await service.getUpdates('bot-1', 0, 200, 0);

      expect(mockRedis.lrange).toHaveBeenCalledWith(
        expect.anything(), 0, 99,
      );
    });
  });

  describe('setWebhook', () => {
    it('should update webhook URL', async () => {
      await service.setWebhook('bot-1', 'https://example.com/webhook');

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should clear webhook when null', async () => {
      await service.setWebhook('bot-1', null);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('sendMedia', () => {
    it('should send media message via NATS', async () => {
      const result = await service.sendMedia('bot-1', 'chat-1', 'photo', 'media-1', 'A photo');

      expect(result.chat_id).toBe('chat-1');
      expect(result.content_type).toBe('photo');
      expect(result.media_id).toBe('media-1');
      expect(result.caption).toBe('A photo');
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should handle missing caption', async () => {
      const result = await service.sendMedia('bot-1', 'chat-1', 'video', 'media-2');

      expect(result.caption).toBeNull();
    });
  });

  describe('editMessageText', () => {
    it('should publish edit event via NATS', async () => {
      const result = await service.editMessageText('bot-1', 'chat-1', 'msg-1', 'Updated text');

      expect(result.chat_id).toBe('chat-1');
      expect(result.message_id).toBe('msg-1');
      expect(result.text).toBe('Updated text');
      expect(mockNats.publish).toHaveBeenCalled();
    });
  });
});
