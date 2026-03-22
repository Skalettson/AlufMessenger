/**
 * E2E тесты для сообщений
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiClient } from '../utils/api-client';
import type { Chat, Message } from '../utils/api-client';

describe('Messages E2E', () => {
  let client: ApiClient;
  let chat: Chat;

  beforeAll(async () => {
    // Создаём тестового пользователя и чат
    client = await ApiClient.createTestUser();
    
    // Создаём тестовый чат
    chat = await client.createChat({
      type: 'private',
    });
  });

  afterAll(async () => {
    await client?.cleanup();
  });

  describe('Send Message', () => {
    it('should send text message', async () => {
      const message = await client.sendMessage(chat.id, { text: 'Hello, World!' });
      
      expect(message.id).toBeDefined();
      expect(message.chatId).toBe(chat.id);
      expect(message.text).toBe('Hello, World!');
      expect(message.type).toBe('text');
      expect(message.senderId).toBe(client.userId);
      expect(message.isPinned).toBe(false);
      expect(message.isEdited).toBe(false);
      expect(message.createdAt).toBeDefined();
    });

    it('should send reply message', async () => {
      const originalMessage = await client.sendMessage(chat.id, { text: 'Original' });
      const replyMessage = await client.sendMessage(chat.id, { 
        text: 'Reply', 
        replyToId: originalMessage.id 
      });
      
      expect(replyMessage.replyToId).toBe(originalMessage.id);
    });

    it('should get messages from chat', async () => {
      const result = await client.getMessages(chat.id, undefined, 50);
      
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.pagination).toBeDefined();
    });
  });

  describe('Edit Message', () => {
    it('should edit message text', async () => {
      const message = await client.sendMessage(chat.id, { text: 'Original text' });
      const edited = await client.editMessage(chat.id, message.id, { text: 'Edited text' });
      
      expect(edited.id).toBe(message.id);
      expect(edited.text).toBe('Edited text');
      expect(edited.isEdited).toBe(true);
      expect(edited.editedAt).toBeDefined();
    });

    it('should not edit message with empty text', async () => {
      const message = await client.sendMessage(chat.id, { text: 'Test' });
      
      try {
        await client.editMessage(chat.id, message.id, { text: '' });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('400');
      }
    });
  });

  describe('Delete Message', () => {
    it('should delete own message', async () => {
      const message = await client.sendMessage(chat.id, { text: 'To be deleted' });
      
      await client.deleteMessage(chat.id, message.id, false);
      
      // Проверяем, что сообщение удалено
      const messages = await client.getMessages(chat.id);
      const deletedMessage = messages.messages.find(m => m.id === message.id);
      expect(deletedMessage).toBeUndefined();
    });

    it('should delete message for all participants', async () => {
      const message = await client.sendMessage(chat.id, { text: 'Delete for all' });
      
      await client.deleteMessage(chat.id, message.id, true);
      
      const messages = await client.getMessages(chat.id);
      const deletedMessage = messages.messages.find(m => m.id === message.id);
      expect(deletedMessage).toBeUndefined();
    });
  });

  describe('Pin Message', () => {
    it('should pin message', async () => {
      const message = await client.sendMessage(chat.id, { text: 'Important message' });
      
      await client.pinMessage(chat.id, message.id);
      
      const updatedMessage = await client.getMessages(chat.id);
      const pinnedMessage = updatedMessage.messages.find(m => m.id === message.id);
      expect(pinnedMessage?.isPinned).toBe(true);
    });

    it('should unpin message', async () => {
      const message = await client.sendMessage(chat.id, { text: 'Unpin test' });
      await client.pinMessage(chat.id, message.id);
      
      await client.unpinMessage(chat.id, message.id);
      
      const updatedMessage = await client.getMessages(chat.id);
      const unpinnedMessage = updatedMessage.messages.find(m => m.id === message.id);
      expect(unpinnedMessage?.isPinned).toBe(false);
    });
  });

  describe('Reactions', () => {
    it('should add reaction to message', async () => {
      const message = await client.sendMessage(chat.id, { text: 'React to this' });
      
      await client.addReaction(chat.id, message.id, '👍');
      
      // Здесь нужна проверка, что реакция добавлена
      // В зависимости от реализации API
    });

    it('should remove reaction from message', async () => {
      const message = await client.sendMessage(chat.id, { text: 'Remove reaction' });
      await client.addReaction(chat.id, message.id, '❤️');
      
      await client.removeReaction(chat.id, message.id);
      
      // Проверка удаления реакции
    });

    it('should add multiple different reactions', async () => {
      const message = await client.sendMessage(chat.id, { text: 'Multiple reactions' });
      
      await client.addReaction(chat.id, message.id, '👍');
      await client.addReaction(chat.id, message.id, '❤️');
      await client.addReaction(chat.id, message.id, '😂');
      
      // Проверка нескольких реакций
    });
  });

  describe('Forward Message', () => {
    it('should forward message to another chat', async () => {
      const sourceChat = await client.createChat({ type: 'private' });
      const targetChat = await client.createChat({ type: 'private' });
      
      const originalMessage = await client.sendMessage(sourceChat.id, { text: 'Forward me' });
      const forwarded = await client.forwardMessage(targetChat.id, originalMessage.id, sourceChat.id);
      
      expect(forwarded.id).toBeDefined();
      expect(forwarded.forwardFromId).toBe(originalMessage.id);
      expect(forwarded.text).toBe('Forward me');
    });
  });

  describe('Message Pagination', () => {
    it('should paginate through messages', async () => {
      // Отправляем 10 сообщений
      for (let i = 0; i < 10; i++) {
        await client.sendMessage(chat.id, { text: `Message ${i}` });
      }
      
      // Получаем первые 5
      const firstPage = await client.getMessages(chat.id, undefined, 5);
      expect(firstPage.messages.length).toBeLessThanOrEqual(5);
      expect(firstPage.pagination.hasMore).toBe(true);
      
      // Получаем следующие 5
      const secondPage = await client.getMessages(chat.id, firstPage.pagination.nextCursor, 5);
      expect(secondPage.messages.length).toBeLessThanOrEqual(5);
    });
  });
});
