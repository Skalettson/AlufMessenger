import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from '../message.service';

vi.mock('@aluf/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aluf/shared')>();
  return {
    ...actual,
    initSnowflake: vi.fn(),
    generateSnowflakeId: vi.fn().mockReturnValue(1234567890n),
    snowflakeToString: vi.fn().mockImplementation((id: bigint) => id?.toString() ?? ''),
    stringToSnowflake: vi.fn().mockImplementation((s: string) => BigInt(s)),
    SELF_DESTRUCT_MAX_SEC_FREE: 86400,
    SELF_DESTRUCT_MAX_SEC_PREMIUM: 604800,
  };
});

const mockNats = {
  publish: vi.fn(),
};

const chainMethods = [
  'select', 'from', 'where', 'limit', 'offset',
  'innerJoin', 'leftJoin', 'orderBy',
  'insert', 'values', 'returning',
  'update', 'set', 'delete',
  'onConflictDoUpdate',
] as const;

// Создаём правильный mock для Drizzle ORM
const createMockDb = () => {
  const mock: any = {};
  for (const m of chainMethods) {
    mock[m] = vi.fn(() => mock);
  }
  
  // Критично: where/orderBy/limit/innerJoin/leftJoins должны возвращать Promise с массивом!
  mock.where.mockResolvedValue([]);
  mock.orderBy.mockResolvedValue([]);
  mock.limit.mockResolvedValue([]);
  mock.returning.mockResolvedValue([]);
  mock.innerJoin.mockResolvedValue([]);
  mock.leftJoin.mockResolvedValue([]);
  
  return mock;
};

const mockDb = createMockDb();

function resetMockDb() {
  Object.assign(mockDb, createMockDb());
}

function mockResolve(value: any) {
  const arrValue = Array.isArray(value) ? value : [value];
  mockDb.then?.mockImplementationOnce((resolve: any) => resolve?.(arrValue));
  mockDb.limit.mockResolvedValueOnce(arrValue);
  mockDb.returning.mockResolvedValueOnce(arrValue);
  mockDb.where.mockResolvedValueOnce(arrValue);
}

const now = new Date();

const sampleMessage = {
  id: 1234567890n,
  chatId: 'chat-1',
  senderId: 'user-1',
  replyToId: null,
  forwardFromId: null,
  forwardFromChatId: null,
  contentType: 'text',
  textContent: 'Hello world',
  mediaId: null,
  metadata: {},
  isEdited: false,
  isPinned: false,
  selfDestructAt: null,
  createdAt: now,
  editedAt: null,
};

const sampleChat = {
  id: 'chat-1',
  type: 'group',
  settings: {},
};

const memberRecord = {
  userId: 'user-1',
  role: 'owner',
  permissions: {
    canDeleteMessages: true,
    canPinMessages: true,
    canEditMessages: true,
  },
};

describe('MessageService', () => {
  let service: MessageService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDb();
    service = new MessageService(mockDb as any, mockNats as any);
  });

  describe('sendMessage', () => {
    it('should send a text message with snowflake ID', async () => {
      mockResolve([memberRecord]);
      mockResolve([sampleChat]);
      mockResolve([sampleMessage]);
      mockResolve([{ id: 'chat-1' }]);

      const result = await service.sendMessage('chat-1', 'user-1', {
        contentType: 'text',
        textContent: 'Hello',
        mediaId: '',
        replyToId: '',
        metadata: {},
        selfDestructSeconds: 0,
      });

      expect(result.id).toBe('1234567890');
      expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should throw when sender is not a chat member', async () => {
      mockResolve([]);

      await expect(
        service.sendMessage('chat-1', 'stranger', {
          contentType: 'text',
          textContent: 'Hello',
          mediaId: '',
          replyToId: '',
          metadata: {},
          selfDestructSeconds: 0,
        }),
      ).rejects.toThrow('Not a member');
    });

    it('should set self-destruct time when seconds > 0', async () => {
      mockResolve([memberRecord]);
      mockResolve([sampleChat]);
      mockResolve([{ isPremium: false }]);
      mockResolve([sampleMessage]);
      mockResolve([{ id: 'chat-1' }]);

      await service.sendMessage('chat-1', 'user-1', {
        contentType: 'text',
        textContent: 'Hello',
        mediaId: '',
        replyToId: '',
        metadata: {},
        selfDestructSeconds: 3600,
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw when self-destruct exceeds free user limit', async () => {
      mockResolve([memberRecord]);
      mockResolve([sampleChat]);
      mockResolve([{ isPremium: false }]);

      await expect(
        service.sendMessage('chat-1', 'user-1', {
          contentType: 'text',
          textContent: 'Hello',
          mediaId: '',
          replyToId: '',
          metadata: {},
          selfDestructSeconds: 700000,
        }),
      ).rejects.toThrow('TTL допустим');
    });

    it('should update the chat last message after sending', async () => {
      mockResolve([memberRecord]);
      mockResolve([sampleChat]);
      mockResolve([sampleMessage]);
      mockResolve([{ id: 'chat-1' }]);

      await service.sendMessage('chat-1', 'user-1', {
        contentType: 'text',
        textContent: 'Hello',
        mediaId: '',
        replyToId: '',
        metadata: {},
        selfDestructSeconds: 0,
      });

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    it('should return messages with pagination info', async () => {
      mockResolve([sampleMessage]);

      const result = await service.getMessages('chat-1', undefined, 20, 1);

      expect(result.messages).toBeDefined();
      expect(result.hasMore).toBeDefined();
    });

    it('should set hasMore when more results exist', async () => {
      const rows = Array(21).fill(sampleMessage);
      mockResolve(rows);

      const result = await service.getMessages('chat-1', undefined, 20, 1);

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBe('');
    });
  });

  describe('editMessage', () => {
    it('should edit message when sender is the editor', async () => {
      mockResolve([sampleMessage]);
      mockResolve([{ type: 'group' }]);
      mockResolve([memberRecord]);
      const edited = { ...sampleMessage, textContent: 'Updated', isEdited: true, editedAt: new Date() };
      mockResolve([edited]);
      mockResolve([
        {
          displayName: 'User',
          avatarUrl: null,
          isPremium: false,
          premiumBadgeEmoji: null,
        },
      ]);

      const result = await service.editMessage('1234567890', 'chat-1', 'user-1', 'Updated');

      expect(result.textContent).toBe('Updated');
      expect(result.isEdited).toBe(true);
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should throw when non-sender tries to edit', async () => {
      mockResolve([sampleMessage]);
      mockResolve([{ type: 'group' }]);
      mockResolve([memberRecord]);

      await expect(
        service.editMessage('1234567890', 'chat-1', 'user-2', 'Hacked'),
      ).rejects.toThrow('Only the sender can edit');
    });

    it('should throw when message not found', async () => {
      mockResolve([]);

      await expect(
        service.editMessage('999', 'chat-1', 'user-1', 'New text'),
      ).rejects.toThrow();
    });
  });

  describe('deleteMessage', () => {
    it('should delete for self by inserting status record', async () => {
      mockResolve([sampleMessage]);
      mockResolve([{ type: 'group' }]);
      mockResolve([memberRecord]);
      mockResolve(undefined);

      await service.deleteMessage('1234567890', 'chat-1', 'user-1', false);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should delete for everyone when sender is within 48h', async () => {
      mockResolve([sampleMessage]);
      mockResolve([{ type: 'group' }]);
      mockResolve([memberRecord]);

      await service.deleteMessage('1234567890', 'chat-1', 'user-1', true);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should throw when non-sender non-admin tries deleteForEveryone', async () => {
      mockResolve([sampleMessage]);
      mockResolve([{ type: 'group' }]);
      mockResolve([{ ...memberRecord, userId: 'user-2', permissions: {} }]);

      await expect(
        service.deleteMessage('1234567890', 'chat-1', 'user-2', true),
      ).rejects.toThrow('Insufficient permissions');
    });

    it('should throw when sender tries deleteForEveryone after 48h', async () => {
      const oldMessage = {
        ...sampleMessage,
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      };
      mockResolve([oldMessage]);
      mockResolve([{ type: 'group' }]);
      mockResolve([memberRecord]);

      await expect(
        service.deleteMessage('1234567890', 'chat-1', 'user-1', true),
      ).rejects.toThrow('48 hours');
    });

    it('should allow admin to delete any message for everyone', async () => {
      mockResolve([sampleMessage]);
      mockResolve([{ type: 'group' }]);
      mockResolve([{ ...memberRecord, role: 'admin' }]);

      await service.deleteMessage('1234567890', 'chat-1', 'admin-user', true);

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('pinMessage', () => {
    it('should pin a message when user has permission', async () => {
      mockResolve([sampleMessage]);
      mockResolve([{ type: 'group' }]);
      mockResolve([memberRecord]);
      mockResolve([{ count: 5 }]);
      mockResolve([{ ...sampleMessage, isPinned: true }]);

      await service.pinMessage('1234567890', 'chat-1', 'user-1');

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw when max pinned messages reached', async () => {
      mockResolve([sampleMessage]);
      mockResolve([{ type: 'group' }]);
      mockResolve([memberRecord]);
      mockResolve([{ count: 100 }]);

      await expect(
        service.pinMessage('1234567890', 'chat-1', 'user-1'),
      ).rejects.toThrow('Cannot pin more than');
    });
  });

  describe('reactToMessage', () => {
    it('should add a new reaction', async () => {
      mockResolve([memberRecord]);
      mockResolve([sampleMessage]);
      mockResolve([]);
      mockResolve([]);
      mockResolve([{ isPremium: false }]);
      mockResolve([{ emoji: '👍', count: 1 }]);

      await service.reactToMessage('1234567890', 'chat-1', 'user-1', '👍');

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should remove reaction when same emoji sent twice', async () => {
      mockResolve([memberRecord]);
      mockResolve([sampleMessage]);
      mockResolve([{ id: 1, emoji: '👍', userId: 'user-1', messageId: sampleMessage.id }]);
      mockResolve([{ userId: 'user-1', emoji: '👍' }]);
      mockResolve([{ isPremium: false }]);
      mockResolve([]);

      await service.reactToMessage('1234567890', 'chat-1', 'user-1', '👍');

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockNats.publish).toHaveBeenCalled();
    });
  });

  describe('forwardMessage', () => {
    it('should forward message to target chat', async () => {
      mockResolve([sampleMessage]);
      mockResolve([memberRecord]);
      mockResolve([sampleChat]);
      mockResolve([{ ...sampleMessage, id: 9999n }]);

      const result = await service.forwardMessage('chat-2', 'chat-1', '1234567890', 'user-1');

      expect(result.id).toBe('9999');
      expect(result.forwardFromId).toBe('1234567890');
    });

    it('should throw when original message not found', async () => {
      mockResolve([]);
      mockResolve([memberRecord]);

      await expect(
        service.forwardMessage('chat-2', 'chat-1', '999', 'user-1'),
      ).rejects.toThrow('Original message');
    });
  });

  describe('hideAuthor (Channel Features)', () => {
    const channelChat = {
      ...sampleChat,
      type: 'channel' as const,
    };

    it('should send message with hideAuthor=false by default', async () => {
      mockResolve([memberRecord]);
      mockResolve([sampleChat]);
      mockResolve([sampleMessage]);
      mockResolve([{ id: 'chat-1' }]);

      await service.sendMessage('chat-1', 'user-1', {
        contentType: 'text',
        textContent: 'Hello',
        mediaId: '',
        replyToId: '',
        metadata: {},
        selfDestructSeconds: 0,
      });

      expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
    });

    it('should throw when hideAuthor is used in non-channel chat', async () => {
      mockResolve([memberRecord]);
      mockResolve([sampleChat]); // group chat

      await expect(
        service.sendMessage('chat-1', 'user-1', {
          contentType: 'text',
          textContent: 'Hello',
          mediaId: '',
          replyToId: '',
          metadata: {},
          selfDestructSeconds: 0,
          hideAuthor: true,
        }),
      ).rejects.toThrow('hideAuthor is only available for channels');
    });

    it('should throw when non-admin tries to use hideAuthor in channel', async () => {
      const memberWithNoPostPermission = {
        ...memberRecord,
        role: 'member' as const,
        permissions: { ...memberRecord.permissions, canPostMessages: false },
      };
      mockResolve([memberWithNoPostPermission]);
      mockResolve([channelChat]);

      await expect(
        service.sendMessage('chat-1', 'user-1', {
          contentType: 'text',
          textContent: 'Hello',
          mediaId: '',
          replyToId: '',
          metadata: {},
          selfDestructSeconds: 0,
          hideAuthor: true,
        }),
      ).rejects.toThrow('Only admins can post in this channel');
    });

    it('should allow admin to send with hideAuthor in channel', async () => {
      const adminMember = {
        ...memberRecord,
        role: 'admin' as const,
        permissions: { ...memberRecord.permissions, canPostMessages: true },
      };
      mockResolve([adminMember]);
      mockResolve([channelChat]);
      mockResolve([sampleMessage]);
      mockResolve([{ id: 'chat-1' }]);

      const result = await service.sendMessage('chat-1', 'user-1', {
        contentType: 'text',
        textContent: 'Channel post',
        mediaId: '',
        replyToId: '',
        metadata: {},
        selfDestructSeconds: 0,
        hideAuthor: true,
      });

      expect(result.id).toBe('1234567890');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should allow owner to send with hideAuthor in channel', async () => {
      mockResolve([memberRecord]);
      mockResolve([channelChat]);
      mockResolve([sampleMessage]);
      mockResolve([{ id: 'chat-1' }]);

      const result = await service.sendMessage('chat-1', 'user-1', {
        contentType: 'text',
        textContent: 'Channel post',
        mediaId: '',
        replyToId: '',
        metadata: {},
        selfDestructSeconds: 0,
        hideAuthor: true,
      });

      expect(result.id).toBe('1234567890');
    });

    it('should allow member with canPostMessages to send with hideAuthor in channel', async () => {
      const memberWithPostPermission = {
        ...memberRecord,
        role: 'member' as const,
        permissions: { ...memberRecord.permissions, canPostMessages: true },
      };
      mockResolve([memberWithPostPermission]);
      mockResolve([channelChat]);
      mockResolve([sampleMessage]);
      mockResolve([{ id: 'chat-1' }]);

      const result = await service.sendMessage('chat-1', 'user-1', {
        contentType: 'text',
        textContent: 'Channel post',
        mediaId: '',
        replyToId: '',
        metadata: {},
        selfDestructSeconds: 0,
        hideAuthor: true,
      });

      expect(result.id).toBe('1234567890');
    });
  });
});
