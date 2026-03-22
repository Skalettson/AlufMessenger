import type { ChatPreview } from '@/stores/chat-store';

/** API chat type: number (1=private, 2=group, 3=channel, 4=supergroup, 5=saved). */
const API_TYPE_TO_PREVIEW: Record<number, ChatPreview['type']> = {
  0: 'saved',
  1: 'private',
  2: 'group',
  3: 'channel',
  4: 'channel', // supergroup -> channel for UI
  5: 'saved',
};

const API_TYPE_STRING_TO_PREVIEW: Record<string, ChatPreview['type']> = {
  CHAT_TYPE_UNSPECIFIED: 'saved',
  CHAT_TYPE_DIRECT: 'private',
  CHAT_TYPE_GROUP: 'group',
  CHAT_TYPE_CHANNEL: 'channel',
  CHAT_TYPE_SUPERGROUP: 'channel',
  CHAT_TYPE_SAVED: 'saved',
  private: 'private',
  group: 'group',
  channel: 'channel',
  supergroup: 'channel',
  saved: 'saved',
};

/** Raw chat object as returned by the API (gRPC/JSON). */
export interface ApiChat {
  id: string;
  type?: number;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  creatorId?: string;
  memberCount?: number;
  lastMessage?: {
    id?: string;
    senderId?: string;
    sender_id?: string;
    senderDisplayName?: string | null;
    sender_display_name?: string | null;
    textContent?: string | null;
    text_content?: string | null;
    contentType?: string;
    content_type?: string;
    sentAt?: { seconds?: number; nanos?: number } | string;
    sent_at?: { seconds?: number; nanos?: number } | string;
  } | null;
  /** gRPC часто возвращает snake_case */
  last_message?: ApiChat['lastMessage'] | null;
  unreadCount?: number;
  unread_count?: number;
  isPinned?: boolean;
  isMuted?: boolean;
  is_muted?: boolean;
  isArchived?: boolean;
  is_archived?: boolean;
  isBot?: boolean;
  is_bot?: boolean;
  isPremium?: boolean;
  is_premium?: boolean;
  premiumBadgeEmoji?: string | null;
  premium_badge_emoji?: string | null;
  isVerified?: boolean;
  is_verified?: boolean;
  isOfficial?: boolean;
  is_official?: boolean;
  myRole?: string | null;
  my_role?: string | null;
  canPostMessages?: boolean;
  can_post_messages?: boolean;
  username?: string | null;
  otherUserId?: string | null;
  other_user_id?: string | null;
  createdAt?: { seconds?: number; nanos?: number } | string;
  updatedAt?: { seconds?: number; nanos?: number } | string;
}

/** gRPC/JSON может отдавать snake_case — выравниваем с лентой сторис. */
export function pickApiAvatarUrl(api: {
  avatarUrl?: string | null;
  avatar_url?: string | null;
} | null | undefined): string | null {
  const v = api?.avatarUrl ?? api?.avatar_url;
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function pickApiUserId(api: { userId?: string | null; user_id?: string | null } | null | undefined): string {
  return String(api?.userId ?? api?.user_id ?? '').trim();
}

function parseTimestamp(
  value: { seconds?: number; nanos?: number } | string | undefined,
): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const ms = value.seconds * 1000 + ((value.nanos ?? 0) / 1_000_000);
    return new Date(ms).toISOString();
  }
  return null;
}

/** Текст превью для последнего сообщения по типу контента (при загрузке списка чатов с API). */
function getMediaPreviewText(contentType: string): string {
  switch (contentType) {
    case 'image': return '[Фото]';
    case 'video': return '[Видео]';
    case 'audio': return '[Аудио]';
    case 'voice': return '[Голосовое]';
    case 'video_note': return '[Видеосообщение]';
    case 'sticker': return '[Стикер]';
    default: return '[Медиа]';
  }
}

/**
 * Maps an API chat response to the ChatPreview shape expected by the store and UI.
 */
export function apiChatToPreview(api: ApiChat): ChatPreview {
  const rawType = api.type as unknown;
  let mappedType: ChatPreview['type'] | null = null;
  if (typeof rawType === 'number') {
    mappedType = API_TYPE_TO_PREVIEW[rawType] ?? null;
  } else if (typeof rawType === 'string') {
    const trimmed = rawType.trim();
    mappedType =
      API_TYPE_STRING_TO_PREVIEW[trimmed] ??
      API_TYPE_TO_PREVIEW[Number.parseInt(trimmed, 10)] ??
      null;
  }
  const nameOrTitle = (api.name ?? api.title ?? '').toString().trim();
  const type: ChatPreview['type'] =
    nameOrTitle === 'Избранное'
      ? 'saved'
      : (mappedType ?? 'private');

  const lastMessage = api.lastMessage ?? api.last_message;
  const lastMessageAt = lastMessage?.sentAt ?? lastMessage?.sent_at
    ? parseTimestamp(lastMessage.sentAt ?? lastMessage.sent_at)
    : null;
  const rawLastText = (lastMessage?.textContent ?? (lastMessage as { text_content?: string | null })?.text_content) ?? null;
  const contentType = lastMessage?.contentType ?? (lastMessage as { content_type?: string })?.content_type;
  const lastMessageText =
    (rawLastText && rawLastText.trim()) || (contentType ? getMediaPreviewText(contentType) : null) || null;
  const lastMessageSender =
    (lastMessage?.senderDisplayName ?? lastMessage?.sender_display_name ?? null)?.trim() || null;

  return {
    id: api.id,
    type,
    title: (api.name ?? api.title ?? '').trim() || null,
    description: (api.description ?? '').toString().trim() || null,
    avatarUrl: pickApiAvatarUrl(api),
    memberCount: api.memberCount ?? 0,
    username: (api.username ?? '').toString().trim() || null,
    lastMessageAt,
    lastMessageText,
    lastMessageSender,
    unreadCount: api.unreadCount ?? api.unread_count ?? 0,
    isMuted: api.isMuted ?? api.is_muted ?? false,
    isPinned: api.isPinned ?? false,
    isBot: api.isBot ?? api.is_bot ?? false,
    isPremium: api.isPremium ?? api.is_premium ?? false,
    premiumBadgeEmoji: (() => {
      const v = api.premiumBadgeEmoji ?? api.premium_badge_emoji;
      if (v == null || v === '') return null;
      const s = String(v).trim();
      return s || null;
    })(),
    isVerified: api.isVerified ?? api.is_verified ?? false,
    isOfficial: api.isOfficial ?? api.is_official ?? false,
    myRole: (api.myRole ?? api.my_role ?? '') || undefined,
    canPostMessages: api.canPostMessages ?? api.can_post_messages ?? true,
    otherUserId: (api.otherUserId ?? api.other_user_id ?? '') || null,
    isArchived: api.isArchived ?? api.is_archived ?? false,
  };
}
