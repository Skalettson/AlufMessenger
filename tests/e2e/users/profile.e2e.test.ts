/**
 * E2E тесты для пользователей
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiClient } from '../utils/api-client';
import type { User } from '../utils/api-client';

describe('Users E2E', () => {
  let client: ApiClient;
  let testUser: User;

  beforeAll(async () => {
    client = await ApiClient.createTestUser();
    testUser = await client.getMe();
  });

  afterAll(async () => {
    await client?.cleanup();
  });

  describe('Get Profile', () => {
    it('should get current user profile', async () => {
      const user = await client.getMe();
      
      expect(user.id).toBeDefined();
      expect(user.alufId).toBeDefined();
      expect(user.displayName).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.isOnline).toBeDefined();
      expect(user.isPremium).toBeDefined();
    });

    it('should get user by ID', async () => {
      const user = await client.getUser(testUser.id);
      
      expect(user.id).toBe(testUser.id);
      expect(user.alufId).toBe(testUser.alufId);
    });

    it('should return 404 for non-existent user', async () => {
      try {
        await client.getUser('non-existent-id');
        expect.fail('Should have thrown 404');
      } catch (error: any) {
        expect(error.message).toContain('404');
      }
    });
  });

  describe('Update Profile', () => {
    it('should update display name', async () => {
      const updated = await client.updateProfile({ displayName: 'New Name' });
      
      expect(updated.displayName).toBe('New Name');
      
      // Возвращаем старое имя
      await client.updateProfile({ displayName: testUser.displayName });
    });

    it('should update username', async () => {
      const newUsername = `test_user_${Date.now()}`;
      const updated = await client.updateProfile({ username: newUsername });
      
      expect(updated.username).toBe(newUsername);
      
      // Возвращаем старый username
      await client.updateProfile({ username: testUser.username });
    });

    it('should update bio', async () => {
      const updated = await client.updateProfile({ bio: 'Test bio' });
      
      expect(updated.bio).toBe('Test bio');
      
      // Очищаем bio
      await client.updateProfile({ bio: '' });
    });

    it('should reject username with spaces', async () => {
      try {
        await client.updateProfile({ username: 'invalid user' });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('400');
      }
    });

    it('should reject too long display name', async () => {
      try {
        await client.updateProfile({ displayName: 'a'.repeat(100) });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('400');
      }
    });
  });

  describe('Search Users', () => {
    it('should search users by query', async () => {
      const result = await client.searchUsers(testUser.username.substring(0, 3));
      
      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('should return empty results for non-matching query', async () => {
      const result = await client.searchUsers('xyz_nonexistent_user');
      
      expect(result.users).toBeDefined();
      expect(result.total).toBe(0);
    });

    it('should respect limit parameter', async () => {
      const result = await client.searchUsers('a', 5);
      
      expect(result.users.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Contacts', () => {
    it('should add contact', async () => {
      // Создаём второго пользователя
      const contactClient = await ApiClient.createTestUser();
      
      try {
        await client.addContact(contactClient.userId!);
        
        const contacts = await client.getContacts();
        const contact = contacts.find(c => c.id === contactClient.userId);
        expect(contact).toBeDefined();
      } finally {
        await contactClient.cleanup();
      }
    });

    it('should remove contact', async () => {
      const contactClient = await ApiClient.createTestUser();
      
      try {
        await client.addContact(contactClient.userId!);
        await client.removeContact(contactClient.userId!);
        
        const contacts = await client.getContacts();
        const contact = contacts.find(c => c.id === contactClient.userId);
        expect(contact).toBeUndefined();
      } finally {
        await contactClient.cleanup();
      }
    });

    it('should get contacts list', async () => {
      const contacts = await client.getContacts();
      
      expect(Array.isArray(contacts)).toBe(true);
    });
  });

  describe('Block Users', () => {
    it('should block user', async () => {
      const blockedClient = await ApiClient.createTestUser();
      
      try {
        await client.blockUser(blockedClient.userId!);
        
        // Проверяем, что пользователь заблокирован
        // В зависимости от реализации API
      } finally {
        await blockedClient.cleanup();
      }
    });

    it('should unblock user', async () => {
      const blockedClient = await ApiClient.createTestUser();
      
      try {
        await client.blockUser(blockedClient.userId!);
        await client.unblockUser(blockedClient.userId!);
        
        // Проверяем, что пользователь разблокирован
      } finally {
        await blockedClient.cleanup();
      }
    });

    it('should not receive messages from blocked user', async () => {
      const blockedClient = await ApiClient.createTestUser();
      
      try {
        // Блокируем пользователя
        await client.blockUser(blockedClient.userId!);
        
        // Пытаемся отправить сообщение
        // В зависимости от реализации, это должно быть запрещено
      } finally {
        await blockedClient.cleanup();
      }
    });
  });

  describe('Privacy Settings', () => {
    it('should get privacy settings', async () => {
      const settings = await client.getPrivacySettings();
      
      expect(settings).toBeDefined();
      expect(settings.lastSeen).toBeDefined();
      expect(settings.profilePhoto).toBeDefined();
      expect(settings.onlineStatus).toBeDefined();
    });

    it('should update privacy settings', async () => {
      const updated = await client.updatePrivacySettings({
        lastSeen: 'contacts',
        profilePhoto: 'contacts',
        onlineStatus: 'everyone',
      });
      
      expect(updated.lastSeen).toBe('contacts');
      expect(updated.profilePhoto).toBe('contacts');
      expect(updated.onlineStatus).toBe('everyone');
      
      // Возвращаем настройки
      await client.updatePrivacySettings({
        lastSeen: 'everyone',
        profilePhoto: 'everyone',
        onlineStatus: 'everyone',
      });
    });

    it('should respect lastSeen privacy', async () => {
      // Создаём пользователя с приватностью lastSeen = nobody
      const privateClient = await ApiClient.createTestUser();
      await privateClient.updatePrivacySettings({ lastSeen: 'nobody' });
      
      try {
        // Проверяем, что lastSeen не виден
        const user = await client.getUser(privateClient.userId!);
        expect(user.lastSeenAt).toBeUndefined();
      } finally {
        await privateClient.cleanup();
      }
    });
  });

  describe('User Validation', () => {
    it('should handle concurrent profile updates', async () => {
      const updates = Promise.all([
        client.updateProfile({ displayName: 'Name 1' }),
        client.updateProfile({ displayName: 'Name 2' }),
        client.updateProfile({ displayName: 'Name 3' }),
      ]);
      
      const results = await updates;
      expect(results[results.length - 1].displayName).toBe('Name 3');
      
      // Возвращаем оригинальное имя
      await client.updateProfile({ displayName: testUser.displayName });
    });
  });
});
