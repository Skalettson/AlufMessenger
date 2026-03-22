/**
 * HTTP клиент для E2E тестов
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  id: string;
  alufId: string;
  username: string;
  displayName: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  isOnline: boolean;
  isPremium: boolean;
}

export interface Chat {
  id: string;
  type: 'private' | 'group' | 'channel';
  name?: string;
  description?: string;
  memberCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice' | 'sticker' | 'location' | 'contact';
  replyToId?: string;
  forwardFromId?: string;
  mediaId?: string;
  isPinned: boolean;
  isEdited: boolean;
  createdAt: string;
  editedAt?: string;
}

export class ApiClient {
  private baseUrl: string;
  private accessToken?: string;
  public userId?: string;

  constructor(baseUrl: string, accessToken?: string) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  static async createTestUser(): Promise<ApiClient> {
    const baseUrl = (global as any).API_URL || 'http://localhost:3000/v1';
    const testPhone = (global as any).TEST_PHONE || '+79990000001';
    
    // Регистрация
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, displayName: 'Test User' }),
    });

    // Получение OTP (в тестах используем фиксированный код)
    const verifyResponse = await fetch(`${baseUrl}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: 'test-request-id', code: '123456' }),
    });

    const tokens = await verifyResponse.json() as TokenPair;
    const client = new ApiClient(baseUrl, tokens.accessToken);
    
    // Получение текущего пользователя
    const userResponse = await fetch(`${baseUrl}/users/me`, {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
    });
    
    if (userResponse.ok) {
      const user = await userResponse.json() as User;
      client.userId = user.id;
    }
    
    return client;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.accessToken && { 'Authorization': `Bearer ${this.accessToken}` }),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API Error: ${response.status} - ${error.message}`);
    }

    return response.json();
  }

  async cleanup() {
    // Очистка ресурсов клиента
    this.accessToken = undefined;
    this.userId = undefined;
  }

  // === AUTH ===
  async login(phone: string): Promise<{ requestId: string; expiresAt: string }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async verifyOtp(requestId: string, code: string): Promise<TokenPair> {
    return this.request('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ requestId, code }),
    });
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  // === USERS ===
  async getMe(): Promise<User> {
    return this.request('/users/me');
  }

  async updateProfile(data: Partial<Pick<User, 'displayName' | 'username' | 'bio'>>): Promise<User> {
    return this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getUser(userId: string): Promise<User> {
    return this.request(`/users/${userId}`);
  }

  async searchUsers(query: string, limit = 20): Promise<{ users: User[]; total: number }> {
    return this.request(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async addContact(contactId: string): Promise<void> {
    await this.request('/users/contacts', {
      method: 'POST',
      body: JSON.stringify({ contactId }),
    });
  }

  async removeContact(contactId: string): Promise<void> {
    await this.request(`/users/contacts/${contactId}`, { method: 'DELETE' });
  }

  async blockUser(userId: string): Promise<void> {
    await this.request(`/users/block/${userId}`, { method: 'POST' });
  }

  async unblockUser(userId: string): Promise<void> {
    await this.request(`/users/block/${userId}`, { method: 'DELETE' });
  }

  // === CHATS ===
  async createChat(data: { type: Chat['type']; name?: string; description?: string; memberIds?: string[] }): Promise<Chat> {
    return this.request('/chats', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getChats(cursor?: string, limit = 50): Promise<{ chats: Chat[]; pagination: { nextCursor?: string; hasMore: boolean } }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return this.request(`/chats?${params}`);
  }

  async getChat(chatId: string): Promise<Chat> {
    return this.request(`/chats/${chatId}`);
  }

  async updateChat(chatId: string, data: Partial<Pick<Chat, 'name' | 'description'>>): Promise<Chat> {
    return this.request(`/chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.request(`/chats/${chatId}`, { method: 'DELETE' });
  }

  async addMembers(chatId: string, memberIds: string[]): Promise<void> {
    await this.request(`/chats/${chatId}/members`, {
      method: 'POST',
      body: JSON.stringify({ memberIds }),
    });
  }

  async removeMember(chatId: string, userId: string): Promise<void> {
    await this.request(`/chats/${chatId}/members/${userId}`, { method: 'DELETE' });
  }

  async joinChat(code: string): Promise<Chat> {
    return this.request(`/chats/join/${code}`, { method: 'POST' });
  }

  async leaveChat(chatId: string): Promise<void> {
    await this.request(`/chats/${chatId}/leave`, { method: 'POST' });
  }

  // === MESSAGES ===
  async sendMessage(chatId: string, data: { text?: string; type?: Message['type']; replyToId?: string; mediaId?: string }): Promise<Message> {
    return this.request(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMessages(chatId: string, cursor?: string, limit = 50): Promise<{ messages: Message[]; pagination: { nextCursor?: string; hasMore: boolean } }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return this.request(`/chats/${chatId}/messages?${params}`);
  }

  async editMessage(chatId: string, messageId: string, data: { text: string }): Promise<Message> {
    return this.request(`/chats/${chatId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteMessage(chatId: string, messageId: string, forAll = false): Promise<void> {
    await this.request(`/chats/${chatId}/messages/${messageId}?forAll=${forAll}`, { method: 'DELETE' });
  }

  async pinMessage(chatId: string, messageId: string): Promise<void> {
    await this.request(`/chats/${chatId}/messages/${messageId}/pin`, { method: 'POST' });
  }

  async unpinMessage(chatId: string, messageId: string): Promise<void> {
    await this.request(`/chats/${chatId}/messages/${messageId}/pin`, { method: 'DELETE' });
  }

  async addReaction(chatId: string, messageId: string, emoji: string): Promise<void> {
    await this.request(`/chats/${chatId}/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  async removeReaction(chatId: string, messageId: string): Promise<void> {
    await this.request(`/chats/${chatId}/messages/${messageId}/react`, { method: 'DELETE' });
  }

  async forwardMessage(chatId: string, messageId: string, fromChatId: string): Promise<Message> {
    return this.request(`/chats/${chatId}/messages/forward`, {
      method: 'POST',
      body: JSON.stringify({ messageId, fromChatId }),
    });
  }

  // === MEDIA ===
  async initUpload(fileName: string, mimeType: string, size: number): Promise<{ uploadId: string; uploadUrl: string; expiresAt: string }> {
    return this.request('/media/upload', {
      method: 'POST',
      body: JSON.stringify({ fileName, mimeType, size }),
    });
  }

  async completeUpload(uploadId: string): Promise<{ id: string; fileName: string; mimeType: string; size: number; url: string }> {
    return this.request(`/media/upload/${uploadId}/complete`, { method: 'POST' });
  }

  async getFile(fileId: string, variant: 'original' | 'thumbnail' = 'original'): Promise<{ id: string; fileName: string; mimeType: string; size: number; url: string }> {
    return this.request(`/media/${fileId}?variant=${variant}`);
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.request(`/media/${fileId}`, { method: 'DELETE' });
  }

  // === CALLS ===
  async startCall(chatId: string, type: 'voice' | 'video'): Promise<{ id: string; chatId: string; type: string; status: string }> {
    return this.request('/calls', {
      method: 'POST',
      body: JSON.stringify({ chatId, type }),
    });
  }

  async joinCall(callId: string): Promise<void> {
    await this.request(`/calls/${callId}/join`, { method: 'POST' });
  }

  async leaveCall(callId: string): Promise<void> {
    await this.request(`/calls/${callId}/leave`, { method: 'POST' });
  }

  async endCall(callId: string): Promise<void> {
    await this.request(`/calls/${callId}/end`, { method: 'POST' });
  }

  async sendSignal(callId: string, type: 'offer' | 'answer' | 'ice-candidate', payload: object): Promise<void> {
    await this.request(`/calls/${callId}/signal`, {
      method: 'POST',
      body: JSON.stringify({ type, payload }),
    });
  }

  // === STORIES ===
  async createStory(data: { mediaId: string; caption?: string; privacy?: { visibility: string; selectedUserIds?: string[] } }): Promise<{ id: string; userId: string; mediaId: string; expiresAt: string }> {
    return this.request('/stories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getContactStories(): Promise<Array<{ user: User; stories: Array<{ id: string; userId: string; mediaId: string }> }>> {
    return this.request('/stories/contacts');
  }

  async getStory(storyId: string): Promise<{ id: string; userId: string; mediaId: string; viewCount: number }> {
    return this.request(`/stories/${storyId}`);
  }

  async deleteStory(storyId: string): Promise<void> {
    await this.request(`/stories/${storyId}`, { method: 'DELETE' });
  }

  async reactToStory(storyId: string, emoji: string): Promise<void> {
    await this.request(`/stories/${storyId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  // === SEARCH ===
  async search(query: string, type?: 'users' | 'messages' | 'chats', limit = 20): Promise<{ results: Array<{ type: string; id: string; score: number; data: object }>; total: number }> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (type) params.append('type', type);
    return this.request(`/search?${params}`);
  }

  // === BOTS ===
  async getBots(): Promise<{ bots: Array<{ id: string; username: string; displayName: string }> }> {
    return this.request('/bots');
  }

  async createBot(data: { username: string; displayName: string }): Promise<{ id: string; username: string; displayName: string; token: string }> {
    return this.request('/bots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBot(botId: string): Promise<{ id: string; username: string; displayName: string; description?: string }> {
    return this.request(`/bots/${botId}`);
  }

  async updateBot(botId: string, data: { description?: string; webhookUrl?: string; isInline?: boolean }): Promise<{ id: string; username: string; displayName: string }> {
    return this.request(`/bots/${botId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteBot(botId: string): Promise<void> {
    await this.request(`/bots/${botId}`, { method: 'DELETE' });
  }

  async regenerateBotToken(botId: string): Promise<{ token: string }> {
    return this.request(`/bots/${botId}/regenerate-token`, { method: 'POST' });
  }

  // === PRIVACY ===
  async getPrivacySettings(): Promise<{ lastSeen: string; profilePhoto: string; onlineStatus: string }> {
    return this.request('/users/privacy');
  }

  async updatePrivacySettings(settings: { lastSeen?: string; profilePhoto?: string; onlineStatus?: string }): Promise<{ lastSeen: string; profilePhoto: string; onlineStatus: string }> {
    return this.request('/users/privacy', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  // === CONTACTS ===
  async getContacts(): Promise<User[]> {
    return this.request('/users/contacts');
  }
}
