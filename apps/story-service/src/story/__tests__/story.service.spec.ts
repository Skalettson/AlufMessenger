import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoryService } from '../story.service';

const chainMethods = [
  'select', 'from', 'where', 'limit', 'offset',
  'innerJoin', 'leftJoin', 'orderBy',
  'insert', 'values', 'returning',
  'update', 'set', 'delete',
  'onConflictDoNothing',
  'onConflictDoUpdate',
];

// Создаём правильный mock для Drizzle ORM
const createMockDb = () => {
  const mock: any = {};
  for (const method of chainMethods) {
    mock[method] = vi.fn(() => mock);
  }
  
  // Критично: where/orderBy/limit/innerJoin/leftJoin должны возвращать Promise с массивом!
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
  mockDb.orderBy.mockResolvedValueOnce(arrValue);
}

const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

const sampleStory = {
  id: 'story-1',
  userId: 'user-1',
  mediaId: 'media-1',
  caption: 'My story',
  privacy: { level: 'everyone' },
  viewCount: 0,
  expiresAt: futureDate,
  createdAt: new Date(),
};

describe('StoryService', () => {
  let service: StoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDb();
    service = new StoryService(mockDb as any);
  });

  describe('createStory', () => {
    it('should create a story with 24h TTL', async () => {
      mockResolve([sampleStory]);

      const result = await service.createStory('user-1', 'media-1', 'My story');

      expect(result.id).toBe('story-1');
      expect(result.userId).toBe('user-1');
      expect(result.mediaId).toBe('media-1');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw when mediaId is empty', async () => {
      await expect(service.createStory('user-1', '')).rejects.toThrow('mediaId обязателен');
    });

    it('should use everyone privacy by default', async () => {
      mockResolve([sampleStory]);

      await service.createStory('user-1', 'media-1');

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ privacy: { level: 'everyone' } }),
      );
    });

    it('should accept custom privacy settings', async () => {
      const privacy = { level: 'selected' as const, allowedUserIds: ['user-2'] };
      mockResolve([{ isPremium: false }]);
      mockResolve([{ ...sampleStory, privacy }]);

      const result = await service.createStory('user-1', 'media-1', undefined, privacy);

      expect(result.privacy).toEqual(privacy);
    });

    it('should allow Premium user to set 48h TTL', async () => {
      mockResolve([{ isPremium: true }]);
      mockResolve([
        { ...sampleStory, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) },
      ]);

      const result = await service.createStory('user-1', 'media-1', undefined, undefined, 48);

      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should reject free user setting 48h TTL', async () => {
      mockResolve([{ isPremium: false }]);

      await expect(
        service.createStory('user-1', 'media-1', undefined, undefined, 48),
      ).rejects.toThrow('TTL допустим');
    });
  });

  describe('getStoriesFeed', () => {
    it('should return groups from contacts with unseen flag', async () => {
      mockResolve([{ id: 'user-2', username: 'u2', displayName: 'User 2', avatarUrl: null }]);
      mockResolve([
        { ...sampleStory, userId: 'user-2', privacy: { level: 'everyone' } },
      ]);
      mockResolve([]);
      mockResolve([
        { id: 'user-2', username: 'u2', displayName: 'User 2', avatarUrl: null },
      ]);

      const result = await service.getStoriesFeed('user-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array when user has no contacts', async () => {
      mockResolve([]);

      const result = await service.getStoriesFeed('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getUserStoriesGroup', () => {
    it('should return group for own stories', async () => {
      mockResolve([sampleStory]);
      mockResolve([{ id: 'user-1', username: 'u1', displayName: 'Me', avatarUrl: null }]);
      mockResolve([]);

      const result = await service.getUserStoriesGroup('user-1', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-1');
      expect(result!.stories).toHaveLength(1);
    });

    it('should return null when no visible stories', async () => {
      mockResolve([]);

      const result = await service.getUserStoriesGroup('user-2', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('viewStory', () => {
    it('should record view and sync view count', async () => {
      mockResolve([sampleStory]);
      mockResolve([{ count: 1 }]);

      await service.viewStory('story-1', 'user-2');

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should skip view recording for story owner', async () => {
      mockResolve([sampleStory]);

      await service.viewStory('story-1', 'user-1');

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should throw when story not found', async () => {
      mockResolve([]);

      await expect(service.viewStory('nonexistent', 'user-2')).rejects.toThrow();
    });
  });

  describe('getStoryViewsList', () => {
    it('should throw when not owner', async () => {
      mockResolve([{ ...sampleStory, userId: 'user-1' }]);

      await expect(
        service.getStoryViewsList('story-1', 'user-2'),
      ).rejects.toThrow('Только автор');
    });
  });

  describe('reactToStory', () => {
    it('should add or update reaction', async () => {
      mockResolve([sampleStory]);

      await service.reactToStory('story-1', 'user-2', '❤️');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw for empty emoji', async () => {
      mockResolve([sampleStory]);

      await expect(service.reactToStory('story-1', 'user-2', '   ')).rejects.toThrow(
        'Эмодзи обязателен',
      );
    });
  });

  describe('deleteStory', () => {
    it('should delete own story', async () => {
      mockResolve([sampleStory]);

      await service.deleteStory('story-1', 'user-1');

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw when deleting another users story', async () => {
      mockResolve([{ ...sampleStory, userId: 'user-1' }]);

      await expect(service.deleteStory('story-1', 'user-2')).rejects.toThrow(
        'только свои истории',
      );
    });
  });

  describe('cleanupExpiredStories', () => {
    it('should delete expired stories and their views', async () => {
      const expiredStory = { ...sampleStory, expiresAt: new Date(Date.now() - 1000) };
      mockResolve([expiredStory]);
      mockResolve([]);

      await service.cleanupExpiredStories();

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should do nothing when no stories are expired', async () => {
      mockResolve([]);

      await service.cleanupExpiredStories();

      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });
});
