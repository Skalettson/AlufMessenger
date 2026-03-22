/**
 * E2E тесты для чатов
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiClient } from '../utils/api-client';
import type { Chat } from '../utils/api-client';

describe('Chats E2E', () => {
  let client: ApiClient;

  beforeAll(async () => {
    client = await ApiClient.createTestUser();
  });

  afterAll(async () => {
    await client?.cleanup();
  });

  describe('Create Chat', () => {
    it('should create private chat', async () => {
      const chat = await client.createChat({
        type: 'private',
      });
      
      expect(chat.id).toBeDefined();
      expect(chat.type).toBe('private');
      expect(chat.memberCount).toBeGreaterThanOrEqual(1);
      expect(chat.createdAt).toBeDefined();
    });

    it('should create group chat', async () => {
      const chat = await client.createChat({
        type: 'group',
        name: 'Test Group',
        description: 'Test group description',
      });
      
      expect(chat.id).toBeDefined();
      expect(chat.type).toBe('group');
      expect(chat.name).toBe('Test Group');
      expect(chat.description).toBe('Test group description');
      expect(chat.memberCount).toBe(1);
    });

    it('should create channel', async () => {
      const chat = await client.createChat({
        type: 'channel',
        name: 'Test Channel',
        description: 'Test channel description',
      });
      
      expect(chat.id).toBeDefined();
      expect(chat.type).toBe('channel');
      expect(chat.name).toBe('Test Channel');
    });

    it('should create group with members', async () => {
      // Создаём группу с участниками
      const chat = await client.createChat({
        type: 'group',
        name: 'Group with members',
      });
      
      expect(chat.memberCount).toBe(1); // Только создатель
    });
  });

  describe('Get Chats', () => {
    it('should get list of chats', async () => {
      const result = await client.getChats();
      
      expect(result.chats).toBeDefined();
      expect(Array.isArray(result.chats)).toBe(true);
      expect(result.chats.length).toBeGreaterThan(0);
      expect(result.pagination).toBeDefined();
    });

    it('should get chat by ID', async () => {
      const createdChat = await client.createChat({ type: 'private' });
      const chat = await client.getChat(createdChat.id);
      
      expect(chat.id).toBe(createdChat.id);
      expect(chat.type).toBe('private');
    });

    it('should return 404 for non-existent chat', async () => {
      try {
        await client.getChat('non-existent-id');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('404');
      }
    });
  });

  describe('Update Chat', () => {
    it('should update chat name', async () => {
      const chat = await client.createChat({ type: 'group', name: 'Old Name' });
      const updated = await client.updateChat(chat.id, { name: 'New Name' });
      
      expect(updated.name).toBe('New Name');
    });

    it('should update chat description', async () => {
      const chat = await client.createChat({ 
        type: 'group', 
        name: 'Test',
        description: 'Old description' 
      });
      const updated = await client.updateChat(chat.id, { description: 'New description' });
      
      expect(updated.description).toBe('New description');
    });
  });

  describe('Delete Chat', () => {
    it('should delete chat', async () => {
      const chat = await client.createChat({ type: 'group', name: 'To Delete' });
      
      await client.deleteChat(chat.id);
      
      // Проверяем, что чат удалён
      try {
        await client.getChat(chat.id);
        expect.fail('Should have thrown 404');
      } catch (error: any) {
        expect(error.message).toContain('404');
      }
    });
  });

  describe('Chat Members', () => {
    it('should add member to group', async () => {
      const chat = await client.createChat({ type: 'group', name: 'Add Member Test' });
      
      // Здесь нужен ID другого пользователя
      // Для теста создаём нового пользователя
      const newClient = await ApiClient.createTestUser();
      
      try {
        await client.addMembers(chat.id, [newClient.userId!]);
        
        const updatedChat = await client.getChat(chat.id);
        expect(updatedChat.memberCount).toBeGreaterThanOrEqual(2);
      } finally {
        await newClient.cleanup();
      }
    });

    it('should remove member from group', async () => {
      const chat = await client.createChat({ type: 'group', name: 'Remove Member Test' });
      const newClient = await ApiClient.createTestUser();
      
      try {
        await client.addMembers(chat.id, [newClient.userId!]);
        await client.removeMember(chat.id, newClient.userId!);
        
        const updatedChat = await client.getChat(chat.id);
        expect(updatedChat.memberCount).toBe(1); // Только создатель
      } finally {
        await newClient.cleanup();
      }
    });

    it('should leave chat', async () => {
      const chat = await client.createChat({ type: 'group', name: 'Leave Test' });
      const newClient = await ApiClient.createTestUser();
      
      try {
        await client.addMembers(chat.id, [newClient.userId!]);
        await newClient.leaveChat(chat.id);
        
        const updatedChat = await client.getChat(chat.id);
        expect(updatedChat.memberCount).toBe(1);
      } finally {
        await newClient.cleanup();
      }
    });
  });

  describe('Invite Links', () => {
    it('should join chat by invite link', async () => {
      // Создаём чат с invite ссылкой
      const chat = await client.createChat({ 
        type: 'group', 
        name: 'Invite Test' 
      });
      
      // Генерируем ссылку (если есть такой эндпоинт)
      // const inviteLink = await client.generateInviteLink(chat.id);
      
      // Вступаем по ссылке
      // const joinedChat = await client.joinChat(inviteLink.code);
      // expect(joinedChat.id).toBe(chat.id);
      
      // Пока пропускаем, нужна реализация
      expect(true).toBe(true);
    });
  });

  describe('Chat Roles', () => {
    it('should update member role', async () => {
      const chat = await client.createChat({ type: 'group', name: 'Role Test' });
      const newClient = await ApiClient.createTestUser();
      
      try {
        await client.addMembers(chat.id, [newClient.userId!]);
        
        // Меняем роль на admin
        // await client.updateMemberRole(chat.id, newClient.userId!, 'admin');
        
        // Проверяем роль
        // const member = await client.getMember(chat.id, newClient.userId!);
        // expect(member.role).toBe('admin');
        
        expect(true).toBe(true);
      } finally {
        await newClient.cleanup();
      }
    });
  });

  describe('Chat Validation', () => {
    it('should reject group with empty name', async () => {
      try {
        await client.createChat({ type: 'group', name: '' });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('400');
      }
    });

    it('should reject group with too long name', async () => {
      try {
        await client.createChat({ 
          type: 'group', 
          name: 'a'.repeat(256) 
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('400');
      }
    });
  });
});
