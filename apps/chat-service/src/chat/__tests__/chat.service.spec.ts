import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService } from '../chat.service';

const mockNats = {
  publish: vi.fn(),
};

// Создаём правильный mock для Drizzle ORM - каждый метод возвращает mock для цепочки
const createMockDb = () => {
  const mock: any = {};
  const chainMethods = [
    'select', 'from', 'where', 'limit', 'offset',
    'innerJoin', 'leftJoin', 'orderBy',
    'insert', 'values', 'returning',
    'update', 'set', 'delete',
  ];

  // Сначала создаём все методы
  for (const method of chainMethods) {
    mock[method] = vi.fn();
  }

  // Настраиваем методы чтобы возвращали mock для цепочки (кроме terminal методов)
  const terminalMethods = ['returning', 'limit'];
  for (const method of chainMethods) {
    if (!terminalMethods.includes(method)) {
      mock[method].mockImplementation(() => mock);
    }
  }

  // Terminal методы возвращают Promise с массивом
  mock.limit.mockResolvedValue([]);
  mock.returning.mockResolvedValue([]);

  // transaction вызывает callback с tx
  mock.transaction = vi.fn(async (fn: any) => {
    const tx = createMockDb();
    return fn(tx);
  });

  return mock;
};

const mockDb = createMockDb();

function resetMockDb() {
  // Полностью пересоздаём mock
  const newMock = createMockDb();
  Object.keys(mockDb).forEach(key => {
    delete mockDb[key];
  });
  Object.assign(mockDb, newMock);
}

// Helper для установки возвращаемых значений в цепочке
function mockResolve(value: any) {
  const arrValue = Array.isArray(value) ? value : [value];
  // Устанавливаем значение для следующего вызова limit/returning
  mockDb.limit.mockResolvedValueOnce(arrValue);
  mockDb.returning.mockResolvedValueOnce(arrValue);
}

const sampleChat = {
  id: 'chat-1',
  type: 'group',
  title: 'Test Group',
  description: null,
  avatarUrl: null,
  createdBy: 'user-1',
  settings: {},
  memberCount: 3,
  inviteLink: null,
  lastMessageId: null,
  lastMessageAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const ownerMember = {
  chatId: 'chat-1',
  userId: 'user-1',
  role: 'owner',
  permissions: {
    canDeleteMessages: true,
    canBanMembers: true,
    canPinMessages: true,
    canEditInfo: true,
    canInviteMembers: true,
    canManageVoiceChats: true,
    canPostMessages: true,
    canEditMessages: true,
  },
};

const regularMember = {
  chatId: 'chat-1',
  userId: 'user-2',
  role: 'member',
  permissions: {
    canDeleteMessages: false,
    canBanMembers: false,
    canPinMessages: false,
    canEditInfo: false,
    canInviteMembers: false,
    canManageVoiceChats: false,
    canPostMessages: true,
    canEditMessages: false,
  },
};

describe('ChatService', () => {
  let service: ChatService;
  const mockGroupChannelService = {
    create: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
  };
  const mockMemberManagementService = {
    addMembers: vi.fn(),
    removeMember: vi.fn(),
    updateRole: vi.fn(),
  };
  const mockGroupChannelAdminService = {
    createInviteLink: vi.fn(),
    getChatByInviteLink: vi.fn(),
    linkDiscussionGroup: vi.fn(),
    unlinkDiscussionGroup: vi.fn(),
    banMember: vi.fn(),
    unbanMember: vi.fn(),
    getBannedMembers: vi.fn(),
    getAuditLog: vi.fn(),
    getModerationSettings: vi.fn(),
    updateModerationSettings: vi.fn(),
    createTopic: vi.fn(),
    updateTopic: vi.fn(),
    deleteTopic: vi.fn(),
    getTopics: vi.fn(),
    toggleTopic: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDb();
    service = new ChatService(
      mockDb as any,
      mockNats as any,
      mockGroupChannelService as any,
      mockMemberManagementService as any,
      mockGroupChannelAdminService as any,
    );
  });

  describe('createChat', () => {
    it('should throw for private chat without exactly one member', async () => {
      await expect(
        service.createChat('private', 'user-1', '', '', '', ['u2', 'u3']),
      ).rejects.toThrow('Private chat requires exactly one other member');
    });

    it('should throw for invalid chat type', async () => {
      await expect(
        service.createChat('invalid', 'user-1', '', '', '', []),
      ).rejects.toThrow('Invalid chat type');
    });

    it('should return existing private chat if one exists', async () => {
      mockResolve([{ ...sampleChat, type: 'private' }]);

      const result = await service.createChat('private', 'user-1', '', '', '', ['user-2']);

      expect(result.type).toBe('private');
    });

    it('should create new private chat when none exists', async () => {
      mockResolve([]); // existing chat check
      mockResolve([{ id: 'new-chat', type: 'private', memberCount: 2 }]); // created chat

      const result = await service.createChat('private', 'user-1', '', '', '', ['user-2']);

      expect(result.type).toBe('private');
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should create group chat with correct members', async () => {
      mockResolve([{ isPremium: false }]); // getIsPremium
      mockResolve([{ id: 'new-group', type: 'group' }]); // created chat

      const result = await service.createChat('group', 'user-1', 'My Group', '', '', ['user-2', 'user-3']);

      expect(result.type).toBe('group');
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should create channel with creator as owner', async () => {
      mockResolve([{ isPremium: false }]); // getIsPremium
      mockResolve([{ id: 'new-channel', type: 'channel' }]); // created chat

      const result = await service.createChat('channel', 'user-1', 'News', 'A channel', '', []);

      expect(result.type).toBe('channel');
    });
  });

  describe('getChat', () => {
    it('should return chat when found', async () => {
      mockResolve([sampleChat]);

      const result = await service.getChat('chat-1');

      expect(result.id).toBe('chat-1');
    });

    it('should throw when chat not found', async () => {
      mockResolve([]);

      await expect(service.getChat('nonexistent')).rejects.toThrow();
    });
  });

  describe('updateChat', () => {
    it('should update chat title when user has permission', async () => {
      mockResolve([sampleChat]);
      mockResolve([ownerMember]);
      mockResolve([{ ...sampleChat, title: 'New Title' }]);

      const result = await service.updateChat('chat-1', 'user-1', { title: 'New Title' });

      expect(result.title).toBe('New Title');
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should throw when chat not found for update', async () => {
      mockResolve([]);

      await expect(
        service.updateChat('nonexistent', 'user-1', { title: 'X' }),
      ).rejects.toThrow();
    });

    it('should throw when user lacks canEditInfo permission', async () => {
      mockResolve([sampleChat]);
      mockResolve([regularMember]);

      await expect(
        service.updateChat('chat-1', 'user-2', { title: 'Hacked' }),
      ).rejects.toThrow();
    });
  });

  describe('deleteChat', () => {
    it('should throw when not a member tries to delete', async () => {
      mockResolve([sampleChat]);
      mockResolve([]); // getMember returns empty

      await expect(
        service.deleteChat('chat-1', 'user-3'),
      ).rejects.toThrow('You are not a member of this chat');
    });

    it('should delete chat when any member requests', async () => {
      mockResolve([sampleChat]);
      mockResolve([regularMember]);
      mockResolve([]); // messages
      mockResolve([]); // calls

      await service.deleteChat('chat-1', 'user-2');

      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should delete chat when owner requests', async () => {
      mockResolve([sampleChat]);
      mockResolve([ownerMember]);
      mockResolve([]); // messages
      mockResolve([]); // calls

      await service.deleteChat('chat-1', 'user-1');

      expect(mockNats.publish).toHaveBeenCalled();
    });
  });

  describe('addMembers', () => {
    it('should throw when adding to private chat', async () => {
      mockResolve([{ ...sampleChat, type: 'private' }]);

      await expect(
        service.addMembers('chat-1', 'user-1', ['user-3']),
      ).rejects.toThrow('Cannot add members to a private chat');
    });

    it('should skip already existing members', async () => {
      mockResolve([sampleChat]);
      mockResolve([ownerMember]);
      mockResolve([{ userId: 'user-3' }]); // existing members

      await service.addMembers('chat-1', 'user-1', ['user-3']);

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('should throw when removing chat owner', async () => {
      mockResolve([sampleChat]);
      mockResolve([ownerMember]);
      mockResolve([ownerMember]);

      await expect(
        service.removeMember('chat-1', 'user-2', 'user-1'),
      ).rejects.toThrow('Cannot remove the chat owner');
    });

    it('should throw when member not found', async () => {
      mockResolve([sampleChat]);
      mockResolve([ownerMember]);
      mockResolve([]); // member to remove not found

      await expect(
        service.removeMember('chat-1', 'user-1', 'unknown'),
      ).rejects.toThrow('Member not found');
    });
  });

  describe('updateMemberRole', () => {
    it('should throw when updater is not a member', async () => {
      mockResolve([]); // updater not a member

      await expect(
        service.updateMemberRole('chat-1', 'stranger', 'user-2', 'admin'),
      ).rejects.toThrow('Not a member');
    });

    it('should throw when non-owner tries to promote to admin', async () => {
      const adminMember = { ...regularMember, role: 'admin' };
      mockResolve([adminMember]); // target user
      mockResolve([regularMember]); // updater

      await expect(
        service.updateMemberRole('chat-1', 'user-2', 'user-3', 'admin'),
      ).rejects.toThrow('owner can promote');
    });

    it('should throw when non-owner tries to transfer ownership', async () => {
      mockResolve([regularMember]); // updater not owner

      await expect(
        service.updateMemberRole('chat-1', 'user-2', 'user-3', 'owner'),
      ).rejects.toThrow();
    });
  });

  describe('joinChat', () => {
    it('should return chat if user is already a member', async () => {
      mockResolve([sampleChat]);
      mockResolve([regularMember]);

      const result = await service.joinChat('chat-1', 'user-2', undefined);

      expect(result.id).toBe('chat-1');
    });

    it('should throw for expired invite link', async () => {
      mockResolve([sampleChat]);
      mockResolve([]); // no existing member
      mockResolve([{ expiresAt: new Date('2020-01-01'), usageLimit: 0, usageCount: 0 }]);

      await expect(service.joinChat('chat-1', 'user-2', undefined)).rejects.toThrow();
    });

    it('should throw when invite link usage limit reached', async () => {
      mockResolve([sampleChat]);
      mockResolve([]);
      mockResolve([{ expiresAt: new Date('2030-01-01'), usageLimit: 5, usageCount: 5 }]);

      await expect(service.joinChat('chat-1', 'user-2', undefined)).rejects.toThrow();
    });
  });

  describe('leaveChat', () => {
    it('should throw when not a member', async () => {
      mockResolve([]); // not a member

      await expect(service.leaveChat('chat-1', 'stranger')).rejects.toThrow();
    });

    it('should throw when leaving a private chat', async () => {
      mockResolve([regularMember]);
      mockResolve([{ ...sampleChat, type: 'private' }]);

      await expect(service.leaveChat('chat-1', 'user-2')).rejects.toThrow();
    });

    it('should leave group chat successfully', async () => {
      mockResolve([regularMember]);
      mockResolve([sampleChat]);
      mockResolve([]); // for update

      await service.leaveChat('chat-1', 'user-2');

      expect(mockNats.publish).toHaveBeenCalled();
    });
  });

  describe('Channel Features', () => {
    const channelChat = {
      ...sampleChat,
      type: 'channel' as const,
      title: 'News Channel',
    };

    describe('getChannelSubscribers', () => {
      it('should throw when chat is not a channel', async () => {
        mockResolve([{ ...sampleChat, type: 'group' }]);

        await expect(
          service.getChannelSubscribers('chat-1', 'user-1', undefined, 20),
        ).rejects.toThrow('This chat is not a channel');
      });

      it('should throw when user lacks canEditInfo permission', async () => {
        mockResolve([channelChat]);
        mockResolve([regularMember]);

        await expect(
          service.getChannelSubscribers('chat-1', 'user-2', undefined, 20),
        ).rejects.toThrow();
      });

      it('should return subscribers list with pagination', async () => {
        mockResolve([channelChat]);
        mockResolve([ownerMember]);
        mockResolve([]); // subscribers query

        const result = await service.getChannelSubscribers('chat-1', 'user-1', undefined, 20);

        expect(result).toHaveProperty('subscribers');
        expect(result).toHaveProperty('nextCursor');
        expect(result).toHaveProperty('hasMore');
      });
    });

    describe('getChannelStats', () => {
      it('should throw when chat is not a channel', async () => {
        mockResolve([{ ...sampleChat, type: 'group' }]);

        await expect(
          service.getChannelStats('chat-1', 7),
        ).rejects.toThrow('This chat is not a channel');
      });

      it('should return channel statistics', async () => {
        mockResolve([channelChat]);
        mockResolve([]); // daily stats
        mockResolve([{ count: 100 }]); // subscriber count
        mockResolve([]); // message stats

        const result = await service.getChannelStats('chat-1', 7);

        expect(result).toHaveProperty('chatId');
        expect(result).toHaveProperty('totalSubscribers');
        expect(result).toHaveProperty('totalViews');
        expect(result).toHaveProperty('period');
      });
    });

    describe('linkDiscussionGroup', () => {
      it('should throw when channel not found', async () => {
        mockResolve([]);

        await expect(
          service.linkDiscussionGroup('chat-1', 'group-1', 'user-1'),
        ).rejects.toThrow('Channel');
      });

      it('should throw when chat is not a channel', async () => {
        mockResolve([{ ...sampleChat, type: 'group' }]);

        await expect(
          service.linkDiscussionGroup('chat-1', 'group-1', 'user-1'),
        ).rejects.toThrow('This chat is not a channel');
      });

      it('should throw when group not found', async () => {
        mockResolve([channelChat]);
        mockResolve([]); // group not found

        await expect(
          service.linkDiscussionGroup('chat-1', 'group-1', 'user-1'),
        ).rejects.toThrow('Group');
      });

      it('should throw when trying to link non-group chat', async () => {
        mockResolve([channelChat]);
        mockResolve([{ ...sampleChat, type: 'channel' }]); // another channel

        await expect(
          service.linkDiscussionGroup('chat-1', 'other-channel', 'user-1'),
        ).rejects.toThrow('Can only link a group or secret chat');
      });

      it('should throw when user is not admin of the group', async () => {
        mockResolve([channelChat]);
        mockResolve([{ ...sampleChat, type: 'group' }]);
        mockResolve([ownerMember]); // channel permission check
        mockResolve([]); // user not a member of group

        await expect(
          service.linkDiscussionGroup('chat-1', 'group-1', 'user-1'),
        ).rejects.toThrow();
      });

      it('should link discussion group successfully', async () => {
        const groupMember = { ...ownerMember, chatId: 'group-1', role: 'owner' as const };
        mockResolve([channelChat]);
        mockResolve([{ ...sampleChat, type: 'group', id: 'group-1' }]);
        mockResolve([ownerMember]); // channel permission
        mockResolve([groupMember]); // group membership
        mockResolve([]); // no existing link
        mockResolve([{ ...channelChat, linkedDiscussionChatId: 'group-1' }]); // updated channel

        const result = await service.linkDiscussionGroup('chat-1', 'group-1', 'user-1');

        expect(result.linkedDiscussionChatId).toBe('group-1');
        expect(mockNats.publish).toHaveBeenCalledWith(
          'aluf.chat.updated',
          expect.objectContaining({ event: 'channel.discussion_linked' }),
        );
      });
    });

    describe('unlinkDiscussionGroup', () => {
      it('should throw when channel not found', async () => {
        mockResolve([]);

        await expect(
          service.unlinkDiscussionGroup('chat-1', 'user-1'),
        ).rejects.toThrow('Channel');
      });

      it('should throw when no discussion group is linked', async () => {
        mockResolve([{ ...channelChat, linkedDiscussionChatId: null }]);

        await expect(
          service.unlinkDiscussionGroup('chat-1', 'user-1'),
        ).rejects.toThrow('No discussion group is linked');
      });

      it('should unlink discussion group successfully', async () => {
        mockResolve([{ ...channelChat, linkedDiscussionChatId: 'group-1' }]);
        mockResolve([ownerMember]);
        mockResolve([{ ...channelChat, linkedDiscussionChatId: null }]);

        const result = await service.unlinkDiscussionGroup('chat-1', 'user-1');

        expect(result.linkedDiscussionChatId).toBeNull();
        expect(mockNats.publish).toHaveBeenCalledWith(
          'aluf.chat.updated',
          expect.objectContaining({ event: 'channel.discussion_unlinked' }),
        );
      });
    });
  });
});
