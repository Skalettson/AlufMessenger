"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_VIDEO_TYPES = exports.SUPPORTED_IMAGE_TYPES = exports.MAX_REACTIONS_PER_MESSAGE_PREMIUM = exports.MAX_REACTIONS_PER_MESSAGE = exports.DEFAULT_MODERATION_SETTINGS = exports.SLOW_MODE_OPTIONS = exports.STORY_TTL_PREMIUM_MAX_HOURS = exports.STORY_TTL_HOURS = exports.PRESENCE_OFFLINE_THRESHOLD_MS = exports.PRESENCE_HEARTBEAT_INTERVAL_MS = exports.TYPING_INDICATOR_TTL_MS = exports.JWT_REFRESH_TOKEN_TTL = exports.JWT_ACCESS_TOKEN_TTL = exports.MAGIC_LINK_TTL_SECONDS = exports.OTP_TTL_SECONDS = exports.OTP_LENGTH = exports.SELF_DESTRUCT_MAX_SEC_PREMIUM = exports.SELF_DESTRUCT_MAX_SEC_FREE = exports.SELF_DESTRUCT_TIMERS = exports.MAX_ACTIVE_SESSIONS = exports.MUSIC_MAX_UPLOAD_BYTES = exports.MAX_FILE_SIZE_PREMIUM = exports.MAX_FILE_SIZE = exports.MAX_CAPTION_LENGTH = exports.MAX_MESSAGE_TEXT_LENGTH = exports.MAX_BOTS_PER_USER_FREE = exports.MAX_BOTS_PER_USER = exports.MAX_TOPICS_PER_GROUP = exports.MAX_PINNED_MESSAGES_PREMIUM = exports.MAX_PINNED_MESSAGES = exports.MAX_CHANNEL_SUBSCRIBERS = exports.MAX_SUPERGROUP_MEMBERS = exports.MAX_GROUP_MEMBERS_FREE = exports.MAX_GROUP_MEMBERS = exports.STATUS_TEXT_MAX_LENGTH = exports.BIO_MAX_LENGTH = exports.DISPLAY_NAME_MAX_LENGTH = exports.CHAT_DESCRIPTION_MAX_LENGTH = exports.CHAT_TITLE_MAX_LENGTH = exports.CHAT_USERNAME_REGEX = exports.CHAT_USERNAME_MAX_LENGTH = exports.CHAT_USERNAME_MIN_LENGTH = exports.USERNAME_REGEX = exports.USERNAME_MAX_LENGTH = exports.USERNAME_MIN_LENGTH = exports.ADMIN_USERNAME = exports.ALUF_SYSTEM_USERNAME = exports.ALUF_BOT_USERNAME = exports.ALUF_ID_MAX = exports.ALUF_ID_MIN = void 0;
exports.GRPC_PACKAGES = exports.NATS_SUBJECTS = exports.MESSAGE_RETENTION_DAYS_FREE = exports.AVATAR_SIZE = exports.THUMBNAIL_SIZE = exports.IMAGE_MAX_DIMENSION = exports.MUSIC_LIBRARY_AUDIO_MIME_TYPES = exports.SUPPORTED_AUDIO_TYPES = exports.SUPPORTED_STICKER_EMOJI_TYPES = void 0;
exports.ALUF_ID_MIN = 100000000n;
exports.ALUF_ID_MAX = 9999999999n;
/** Системный бот Aluf для Premium и поддержки */
exports.ALUF_BOT_USERNAME = 'AlufBot';
/** Username системного владельца (не показывать в поиске пользователей). */
exports.ALUF_SYSTEM_USERNAME = 'aluf_system';
/** Username платформенного администратора (dev-режим). */
exports.ADMIN_USERNAME = 'adrian_petrov';
exports.USERNAME_MIN_LENGTH = 3;
exports.USERNAME_MAX_LENGTH = 32;
exports.USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,31}$/;
/** Публичная ссылка канала/группы (как в Telegram: 5–32 символа, только a-z, 0-9, _) */
exports.CHAT_USERNAME_MIN_LENGTH = 5;
exports.CHAT_USERNAME_MAX_LENGTH = 32;
exports.CHAT_USERNAME_REGEX = /^[a-z0-9_]+$/;
/** Название чата/канала/группы (Telegram: до 255 символов) */
exports.CHAT_TITLE_MAX_LENGTH = 255;
exports.CHAT_DESCRIPTION_MAX_LENGTH = 255;
exports.DISPLAY_NAME_MAX_LENGTH = 64;
exports.BIO_MAX_LENGTH = 500;
exports.STATUS_TEXT_MAX_LENGTH = 70;
exports.MAX_GROUP_MEMBERS = 200_000;
/** Лимит участников группы для бесплатных пользователей */
exports.MAX_GROUP_MEMBERS_FREE = 200;
/** Лимит участников супергруппы */
exports.MAX_SUPERGROUP_MEMBERS = 500_000;
exports.MAX_CHANNEL_SUBSCRIBERS = Infinity;
exports.MAX_PINNED_MESSAGES = 100;
/** Лимит закреплённых сообщений для Premium */
exports.MAX_PINNED_MESSAGES_PREMIUM = 200;
/** Лимит тем в группе */
exports.MAX_TOPICS_PER_GROUP = 100;
/** Максимум ботов на одного владельца */
exports.MAX_BOTS_PER_USER = 20;
/** Лимит ботов для бесплатных пользователей */
exports.MAX_BOTS_PER_USER_FREE = 3;
exports.MAX_MESSAGE_TEXT_LENGTH = 4096;
exports.MAX_CAPTION_LENGTH = 1024;
exports.MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024; // 4 ГБ
exports.MAX_FILE_SIZE_PREMIUM = 8 * 1024 * 1024 * 1024; // 8 ГБ
/** Макс. размер одного файла в «Моей музыке» (аудио). */
exports.MUSIC_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
exports.MAX_ACTIVE_SESSIONS = 10;
exports.SELF_DESTRUCT_TIMERS = [1, 2, 3, 5, 10, 15, 30, 60, 300, 3600, 86400, 604800];
/** Макс. таймер самоуничтожения для бесплатных (24 ч) */
exports.SELF_DESTRUCT_MAX_SEC_FREE = 86400;
/** Макс. таймер самоуничтожения для Premium (7 дней) */
exports.SELF_DESTRUCT_MAX_SEC_PREMIUM = 604800;
exports.OTP_LENGTH = 6;
exports.OTP_TTL_SECONDS = 300;
exports.MAGIC_LINK_TTL_SECONDS = 600;
exports.JWT_ACCESS_TOKEN_TTL = 15 * 60; // 15 минут
exports.JWT_REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 дней
exports.TYPING_INDICATOR_TTL_MS = 5000;
exports.PRESENCE_HEARTBEAT_INTERVAL_MS = 30_000;
exports.PRESENCE_OFFLINE_THRESHOLD_MS = 60_000;
exports.STORY_TTL_HOURS = 24;
/** Макс. TTL историй для Premium в часах (7 дней) */
exports.STORY_TTL_PREMIUM_MAX_HOURS = 168;
exports.SLOW_MODE_OPTIONS = [0, 10, 30, 60, 300, 900, 3600];
/** Настройки модерации по умолчанию */
exports.DEFAULT_MODERATION_SETTINGS = {
    forbiddenWords: [],
    forbiddenWordsMode: 'warn',
    antiSpamEnabled: false,
    antiSpamMessagesLimit: 5,
    antiSpamTimeWindow: 10,
    antiSpamAction: 'warn',
    linksAllowed: true,
    linksRequireApproval: false,
    captchaEnabled: false,
    captchaTimeout: 300,
    mediaRequireApproval: false,
    autoDeleteSpam: false,
    autoBanRepeatOffenders: false,
};
/** Макс. число разных эмодзи (типов реакций) на одно сообщение без Premium */
exports.MAX_REACTIONS_PER_MESSAGE = 5;
/** То же для Premium */
exports.MAX_REACTIONS_PER_MESSAGE_PREMIUM = 10;
exports.SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
exports.SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
/** Типы медиа для стикеров и кастомных эмодзи (изображения + WebM для анимации). */
exports.SUPPORTED_STICKER_EMOJI_TYPES = [...exports.SUPPORTED_IMAGE_TYPES, 'video/webm'];
exports.SUPPORTED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'];
/** Расширенный список для библиотеки музыки (m4a/aac и т.д.). */
exports.MUSIC_LIBRARY_AUDIO_MIME_TYPES = [
    ...exports.SUPPORTED_AUDIO_TYPES,
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/flac',
];
exports.IMAGE_MAX_DIMENSION = 10_000;
exports.THUMBNAIL_SIZE = 320;
exports.AVATAR_SIZE = 512;
/** Хранение истории сообщений для бесплатных (дней); null = без ограничения */
exports.MESSAGE_RETENTION_DAYS_FREE = 365;
exports.NATS_SUBJECTS = {
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
};
exports.GRPC_PACKAGES = {
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
};
//# sourceMappingURL=constants.js.map