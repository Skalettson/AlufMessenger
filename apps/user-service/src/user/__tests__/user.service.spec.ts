import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../user.service';

const chainMethods = [
  'select', 'from', 'where', 'limit', 'offset',
  'innerJoin',
  'insert', 'values', 'returning',
  'update', 'set', 'delete',
  'onConflictDoUpdate',
] as const;

const mockDb: any = {};
for (const m of chainMethods) {
  mockDb[m] = vi.fn(() => mockDb);
}
mockDb.then = vi.fn((resolve: any) => resolve?.([]));

function resetMockDb() {
  for (const m of chainMethods) {
    mockDb[m].mockImplementation(() => mockDb);
  }
  mockDb.then.mockImplementation((resolve: any) => resolve?.([]));
}

function mockResolve(value: any) {
  mockDb.then.mockImplementationOnce((resolve: any) => resolve?.(value));
}

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  mget: vi.fn().mockResolvedValue([]),
};

const sampleUser = {
  id: 'user-1',
  alufId: 100000001n,
  username: 'alice',
  displayName: 'Alice',
  phone: '+79991234567',
  email: null,
  avatarUrl: null,
  bio: null,
  statusText: null,
  statusEmoji: null,
  isPremium: false,
  createdAt: new Date('2025-01-01'),
  lastSeenAt: null,
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDb();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.mget.mockResolvedValue([]);
    service = new UserService(mockDb as any, mockRedis as any);
  });

  describe('getUserById', () => {
    it('should return user with online status when found', async () => {
      mockResolve([sampleUser]);

      const result = await service.getUserById('user-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('user-1');
      expect(result!.username).toBe('alice');
      expect(result!.isOnline).toBe(false);
    });

    it('should return null when user not found', async () => {
      mockResolve([]);

      const result = await service.getUserById('nonexistent');

      expect(result).toBeNull();
    });

    it('should show user as online when presence key exists', async () => {
      mockResolve([sampleUser]);
      mockRedis.get.mockResolvedValueOnce('1700000000000');

      const result = await service.getUserById('user-1');

      expect(result!.isOnline).toBe(true);
    });
  });

  describe('getUserByUsername', () => {
    it('should return user when found by username', async () => {
      mockResolve([sampleUser]);

      const result = await service.getUserByUsername('alice');

      expect(result).not.toBeNull();
      expect(result!.username).toBe('alice');
    });

    it('should return null when username not found', async () => {
      mockResolve([]);

      const result = await service.getUserByUsername('unknown');

      expect(result).toBeNull();
    });
  });

  describe('getUsersByIds', () => {
    it('should return empty array for empty ids', async () => {
      const result = await service.getUsersByIds([]);
      expect(result).toEqual([]);
    });

    it('should return users with online status for multiple ids', async () => {
      const user2 = { ...sampleUser, id: 'user-2', username: 'bob' };
      mockResolve([sampleUser, user2]);
      mockRedis.mget.mockResolvedValueOnce(['1700000000', null]);

      const result = await service.getUsersByIds(['user-1', 'user-2']);

      expect(result).toHaveLength(2);
    });
  });

  describe('updateProfile', () => {
    it('should update display name successfully', async () => {
      const updated = { ...sampleUser, displayName: 'Alice Updated' };
      mockResolve([updated]);

      const result = await service.updateProfile('user-1', { displayName: 'Alice Updated' });

      expect(result.displayName).toBe('Alice Updated');
    });

    it('should throw on invalid username format', async () => {
      await expect(
        service.updateProfile('user-1', { username: '123invalid' }),
      ).rejects.toThrow('Invalid username format');
    });

    it('should throw on duplicate username owned by another user', async () => {
      mockResolve([{ id: 'other-user' }]);

      await expect(
        service.updateProfile('user-1', { username: 'taken_name' }),
      ).rejects.toThrow('Username already taken');
    });

    it('should allow updating to own existing username', async () => {
      mockResolve([{ id: 'user-1' }]);
      const updated = { ...sampleUser, username: 'alice' };
      mockResolve([updated]);

      const result = await service.updateProfile('user-1', { username: 'alice' });

      expect(result.username).toBe('alice');
    });

    it('should throw when user not found', async () => {
      mockResolve([]);

      await expect(
        service.updateProfile('nonexistent', { displayName: 'Test' }),
      ).rejects.toThrow('User not found');
    });
  });

  describe('searchUsers', () => {
    it('should return matching users with total count', async () => {
      mockResolve([{ count: 2 }]);
      mockResolve([sampleUser]);

      const result = await service.searchUsers('ali', 10, 0);

      expect(result.totalCount).toBe(2);
      expect(result.users).toHaveLength(1);
    });

    it('should return empty when no matches', async () => {
      mockResolve([{ count: 0 }]);
      mockResolve([]);

      const result = await service.searchUsers('zzzzz', 10, 0);

      expect(result.totalCount).toBe(0);
      expect(result.users).toEqual([]);
    });
  });

  describe('addContact', () => {
    it('should add a contact successfully', async () => {
      mockResolve([{ ...sampleUser, id: 'contact-1' }]);
      mockResolve([{
        userId: 'user-1',
        contactUserId: 'contact-1',
        customName: null,
        isBlocked: false,
        createdAt: new Date(),
      }]);

      const result = await service.addContact('user-1', 'contact-1');

      expect(result.contactUserId).toBe('contact-1');
      expect(result.contactUser).toBeDefined();
    });

    it('should throw when contact user not found', async () => {
      mockResolve([]);

      await expect(
        service.addContact('user-1', 'nonexistent'),
      ).rejects.toThrow('Contact user not found');
    });

    it('should throw when adding self as contact', async () => {
      mockResolve([sampleUser]);

      await expect(
        service.addContact('user-1', 'user-1'),
      ).rejects.toThrow('Cannot add self as contact');
    });
  });

  describe('removeContact', () => {
    it('should remove a contact successfully', async () => {
      mockResolve([{ userId: 'user-1' }]);

      await expect(service.removeContact('user-1', 'contact-1')).resolves.toBeUndefined();
    });

    it('should throw when contact not found', async () => {
      mockResolve([]);

      await expect(
        service.removeContact('user-1', 'unknown'),
      ).rejects.toThrow('Contact not found');
    });
  });

  describe('blockUser', () => {
    it('should block a user via upsert', async () => {
      mockResolve(undefined);

      await service.blockUser('user-1', 'target-1');
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('unblockUser', () => {
    it('should unblock a user', async () => {
      mockResolve(undefined);

      await service.unblockUser('user-1', 'target-1');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('updatePrivacy', () => {
    it('should merge new privacy settings', async () => {
      mockResolve([{
        privacySettings: { lastSeen: 0, profilePhoto: 0 },
      }]);
      mockResolve(undefined);

      await service.updatePrivacy('user-1', { lastSeen: 1, readReceipts: false });

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
    });

    it('should throw when user not found', async () => {
      mockResolve([]);

      await expect(
        service.updatePrivacy('nonexistent', { lastSeen: 1 }),
      ).rejects.toThrow('User not found');
    });
  });

  describe('getPrivacy', () => {
    it('should return privacy settings when they exist', async () => {
      mockResolve([{
        privacySettings: { lastSeen: 1, readReceipts: true },
      }]);

      const result = await service.getPrivacy('user-1');

      expect(result).not.toBeNull();
      expect(result!.lastSeen).toBe(1);
      expect(result!.readReceipts).toBe(true);
    });

    it('should return null when user not found', async () => {
      mockResolve([]);

      const result = await service.getPrivacy('nonexistent');

      expect(result).toBeNull();
    });

    it('should return empty object when settings are null', async () => {
      mockResolve([{ privacySettings: null }]);

      const result = await service.getPrivacy('user-1');

      expect(result).toEqual({});
    });
  });
});
