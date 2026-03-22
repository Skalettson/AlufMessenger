export interface User {
  id: string;
  alufId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  bio: string | null;
  statusText: string | null;
  statusEmoji: string | null;
  premiumBadgeEmoji?: string | null;
  isPremium: boolean;
  isBot?: boolean;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  /** Есть в контактах у текущего пользователя (карточка профиля). */
  isContact?: boolean;
}

export interface Chat {
  id: string;
  type: 'private' | 'group' | 'channel' | 'secret' | 'saved';
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  memberCount: number;
  lastMessageAt: string | null;
  settings: Record<string, unknown> | null;
  inviteLink: string | null;
  /** Публичный username канала (только для type=channel). */
  username?: string | null;
}

export interface ChatMember {
  chatId: string;
  userId: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joinedAt: string;
  mutedUntil: string | null;
}

/** Медиа по mediaId, URL подставляется через useMediaUrl. */
export interface Story {
  id: string;
  userId: string;
  mediaId: string;
  mediaUrl?: string | null;
  caption: string | null;
  viewCount: number;
  expiresAt: string;
  createdAt: string;
  viewed?: boolean;
}

export interface Call {
  id: string;
  chatId: string;
  initiatorId: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined' | 'busy';
  startedAt: string | null;
  endedAt: string | null;
}

export interface Session {
  id: string;
  deviceName: string;
  platform: string;
  ip: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export type PrivacyLevel = 'everyone' | 'contacts' | 'nobody';

export interface PrivacySettings {
  lastSeen: PrivacyLevel;
  profilePhoto: PrivacyLevel;
  about: PrivacyLevel;
  forwardedMessages: PrivacyLevel;
  groups: PrivacyLevel;
  calls: PrivacyLevel;
  readReceipts: boolean;
}

export interface SearchResult {
  type: 'user' | 'chat' | 'message';
  user?: User;
  chat?: Chat;
  message?: { id: string; chatId: string; text: string; senderId: string; createdAt: string };
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface WebhookStatus {
  lastDeliveryAt: string;
  lastSuccessAt?: string;
  lastError?: string;
  lastStatusCode?: number;
}

export interface Bot {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  description: string | null;
  commands: BotCommand[];
  webhookUrl: string | null;
  isInline: boolean;
  createdAt: string;
  webhookStatus?: WebhookStatus | null;
  chatCount?: number;
}
