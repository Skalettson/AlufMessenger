import { describe, it, expect, beforeEach } from 'vitest';
import { SearchService } from '../search.service';

describe('SearchService (in-memory)', () => {
  let service: SearchService;

  beforeEach(() => {
    service = new SearchService();
  });

  describe('search', () => {
    it('should throw for empty query', async () => {
      await expect(service.search('   ')).rejects.toThrow('не может быть пустым');
    });

    it('should search single index when type is provided', async () => {
      await service.indexDocument('users', 'u1', {
        username: 'alice',
        display_name: 'Alice',
      });

      const result = await service.search('alice', 'users');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].type).toBe('users');
      expect(result.results[0].id).toBe('u1');
      expect(result.total).toBe(1);
    });

    it('should search all indexes when no type provided', async () => {
      await service.indexDocument('users', 'u1', { username: 'testuser' });
      await service.indexDocument('messages', 'm1', {
        text_content: 'test message',
        chat_id: 'c1',
        created_at: Math.floor(Date.now() / 1000),
      });

      const result = await service.search('test');

      expect(result.results.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
    });

    it('should sort multi-index results by score descending', async () => {
      await service.indexDocument('users', 'u1', { username: 'match_low' });
      await service.indexDocument('messages', 'm1', {
        text_content: 'high high high match match',
        chat_id: 'c1',
        created_at: Math.floor(Date.now() / 1000),
      });

      const result = await service.search('match');

      expect(result.results.length).toBeGreaterThanOrEqual(2);
      expect(result.results[0].score).toBeGreaterThanOrEqual(result.results[1].score);
    });

    it('should apply chat filter for messages type', async () => {
      await service.indexDocument('messages', 'm1', {
        text_content: 'hello',
        chat_id: 'chat-1',
        created_at: Math.floor(Date.now() / 1000),
      });
      await service.indexDocument('messages', 'm2', {
        text_content: 'hello',
        chat_id: 'chat-2',
        created_at: Math.floor(Date.now() / 1000),
      });

      const result = await service.search('hello', 'messages', 'chat-1');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('m1');
    });

    it('should clamp limit to maximum 100', async () => {
      for (let i = 0; i < 120; i++) {
        await service.indexDocument('users', `u${i}`, {
          username: `user_${i}_clamp_test`,
          display_name: 'X',
        });
      }

      const result = await service.search('clamp_test', 'users', undefined, undefined, undefined, 200);

      expect(result.results.length).toBeLessThanOrEqual(100);
    });

    it('should extract highlights from matching fields', async () => {
      await service.indexDocument('users', 'u1', {
        username: 'alice',
        display_name: 'Alice',
      });

      const result = await service.search('ali', 'users');

      expect(result.results[0].highlights.length).toBeGreaterThanOrEqual(1);
      expect(result.results[0].highlights[0].snippet).toContain('<em>');
    });
  });

  describe('indexDocument', () => {
    it('should index a document and make it searchable', async () => {
      await service.indexDocument('users', 'u1', { username: 'alice', display_name: 'Alice' });

      const result = await service.search('alice', 'users');
      expect(result.results).toHaveLength(1);
    });

    it('should throw for invalid index type', async () => {
      await expect(service.indexDocument('invalid', 'id1', {})).rejects.toThrow('Неизвестный тип индекса');
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document from the index', async () => {
      await service.indexDocument('messages', 'm1', {
        text_content: 'bye',
        chat_id: 'c1',
        created_at: Math.floor(Date.now() / 1000),
      });
      await service.deleteDocument('messages', 'm1');

      const result = await service.search('bye', 'messages');
      expect(result.results).toHaveLength(0);
    });

    it('should throw for invalid index type', async () => {
      await expect(service.deleteDocument('unknown', 'id1')).rejects.toThrow('Неизвестный тип индекса');
    });
  });
});
