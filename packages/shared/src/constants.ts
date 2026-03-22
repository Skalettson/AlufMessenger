export const ALUF_ID_MIN = 100_000_000n;
export const ALUF_ID_MAX = 9_999_999_999n;

/** Системный бот Aluf для Premium и поддержки */
export const ALUF_BOT_USERNAME = 'AlufBot';

/** Username системного владельца (не показывать в поиске пользователей). */
export const ALUF_SYSTEM_USERNAME = 'aluf_system';

/** Username платформенного администратора (dev-режим). */
export const ADMIN_USERNAME = 'adrian_petrov';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,31}$/;

/** Публичная ссылка канала/группы (как в Telegram: 5–32 символа, только a-z, 0-9, _) */
export const CHAT_USERNAME_MIN_LENGTH = 5;
export const CHAT_USERNAME_MAX_LENGTH = 32;
export const CHAT_USERNAME_REGEX = /^[a-z0-9_]+$/;
/** Название чата/канала/группы (Telegram: до 255 символов) */
export const CHAT_TITLE_MAX_LENGTH = 255;
export const CHAT_DESCRIPTION_MAX_LENGTH = 255;

export const DISPLAY_NAME_MAX_LENGTH = 64;
export const BIO_MAX_LENGTH = 500;
export const STATUS_TEXT_MAX_LENGTH = 70;

export const MAX_GROUP_MEMBERS = 200_000;
/** Лимит участников группы для бесплатных пользователей */
export const MAX_GROUP_MEMBERS_FREE = 200;
/** Лимит участников супергруппы */
export const MAX_SUPERGROUP_MEMBERS = 500_000;
export const MAX_CHANNEL_SUBSCRIBERS = Infinity;
export const MAX_PINNED_MESSAGES = 100;
/** Лимит закреплённых сообщений для Premium */
export const MAX_PINNED_MESSAGES_PREMIUM = 200;
/** Лимит тем в группе */
export const MAX_TOPICS_PER_GROUP = 100;

/** Максимум ботов на одного владельца */
export const MAX_BOTS_PER_USER = 20;
/** Лимит ботов для бесплатных пользователей */
export const MAX_BOTS_PER_USER_FREE = 3;

export const MAX_MESSAGE_TEXT_LENGTH = 4096;
export const MAX_CAPTION_LENGTH = 1024;
export const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024; // 4 ГБ
export const MAX_FILE_SIZE_PREMIUM = 8 * 1024 * 1024 * 1024; // 8 ГБ

/** Макс. размер одного файла в «Моей музыке» (аудио). */
export const MUSIC_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const MAX_ACTIVE_SESSIONS = 10;

export const SELF_DESTRUCT_TIMERS = [1, 2, 3, 5, 10, 15, 30, 60, 300, 3600, 86400, 604800] as const;
/** Макс. таймер самоуничтожения для бесплатных (24 ч) */
export const SELF_DESTRUCT_MAX_SEC_FREE = 86400;
/** Макс. таймер самоуничтожения для Premium (7 дней) */
export const SELF_DESTRUCT_MAX_SEC_PREMIUM = 604800;

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300;
export const MAGIC_LINK_TTL_SECONDS = 600;

export const JWT_ACCESS_TOKEN_TTL = 15 * 60; // 15 минут
export const JWT_REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 дней

export const TYPING_INDICATOR_TTL_MS = 5000;
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 30_000;
export const PRESENCE_OFFLINE_THRESHOLD_MS = 60_000;

export const STORY_TTL_HOURS = 24;
/** Макс. TTL историй для Premium в часах (7 дней) */
export const STORY_TTL_PREMIUM_MAX_HOURS = 168;

export const SLOW_MODE_OPTIONS = [0, 10, 30, 60, 300, 900, 3600] as const;

/** Настройки модерации по умолчанию */
export const DEFAULT_MODERATION_SETTINGS = {
  forbiddenWords: [] as string[],
  forbiddenWordsMode: 'warn' as 'warn' | 'delete' | 'ban',
  antiSpamEnabled: false,
  antiSpamMessagesLimit: 5,
  antiSpamTimeWindow: 10,
  antiSpamAction: 'warn' as 'warn' | 'mute' | 'ban',
  linksAllowed: true,
  linksRequireApproval: false,
  captchaEnabled: false,
  captchaTimeout: 300,
  mediaRequireApproval: false,
  autoDeleteSpam: false,
  autoBanRepeatOffenders: false,
};

/** Макс. число разных эмодзи (типов реакций) на одно сообщение без Premium */
export const MAX_REACTIONS_PER_MESSAGE = 5;
/** То же для Premium */
export const MAX_REACTIONS_PER_MESSAGE_PREMIUM = 10;

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
/** Типы медиа для стикеров и кастомных эмодзи (изображения + WebM для анимации). */
export const SUPPORTED_STICKER_EMOJI_TYPES = [...SUPPORTED_IMAGE_TYPES, 'video/webm'] as const;
export const SUPPORTED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'] as const;
/** Расширенный список для библиотеки музыки (m4a/aac и т.д.). */
export const MUSIC_LIBRARY_AUDIO_MIME_TYPES = [
  ...SUPPORTED_AUDIO_TYPES,
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/flac',
] as const;

export const IMAGE_MAX_DIMENSION = 10_000;
export const THUMBNAIL_SIZE = 320;
export const AVATAR_SIZE = 512;

/** Хранение истории сообщений для бесплатных (дней); null = без ограничения */
export const MESSAGE_RETENTION_DAYS_FREE = 365;

export const NATS_SUBJECTS = {
  MESSAGE_INCOMING: 'aluf.message.incoming',
  MESSAGE_SENT: 'aluf.message.sent',
  MESSAGE_DELIVERED: 'aluf.message.delivered',
  MESSAGE_READ: 'aluf.message.read',
  MESSAGE_EDITED: 'aluf.message.edited',
  MESSAGE_DELETED: 'aluf.message.deleted',
  /** Сводка реакций после add/remove (для синхронизации у всех участников чата) */
  MESSAGE_REACTION: 'aluf.message.reaction',
  TYPING: 'aluf.typing',
  PRESENCE: 'aluf.presence',
  NOTIFICATION: 'aluf.notification',
  EMAIL_SEND: 'aluf.email.send',
  CALL_SIGNAL: 'aluf.call.signal',
  USER_UPDATED: 'aluf.user.updated',
  CHAT_UPDATED: 'aluf.chat.updated',
  SEARCH_INDEX: 'aluf.search.index',
} as const;

export const GRPC_PACKAGES = {
  AUTH: 'aluf.auth.v1',
  USER: 'aluf.user.v1',
  CHAT: 'aluf.chat.v1',
  MESSAGE: 'aluf.message.v1',
  MEDIA: 'aluf.media.v1',
  NOTIFICATION: 'aluf.notification.v1',
  CALL: 'aluf.call.v1',
  SEARCH: 'aluf.search.v1',
  STORY: 'aluf.story.v1',
  BOT: 'aluf.bot.v1',
  STICKER: 'aluf.sticker.v1',
  CUSTOM_EMOJI: 'aluf.custom_emoji.v1',
  MUSIC: 'aluf.music.v1',
} as const;
