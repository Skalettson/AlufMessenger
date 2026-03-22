export declare const ALUF_ID_MIN = 100000000n;
export declare const ALUF_ID_MAX = 9999999999n;
/** Системный бот Aluf для Premium и поддержки */
export declare const ALUF_BOT_USERNAME = "AlufBot";
/** Username системного владельца (не показывать в поиске пользователей). */
export declare const ALUF_SYSTEM_USERNAME = "aluf_system";
/** Username платформенного администратора (dev-режим). */
export declare const ADMIN_USERNAME = "adrian_petrov";
export declare const USERNAME_MIN_LENGTH = 3;
export declare const USERNAME_MAX_LENGTH = 32;
export declare const USERNAME_REGEX: RegExp;
/** Публичная ссылка канала/группы (как в Telegram: 5–32 символа, только a-z, 0-9, _) */
export declare const CHAT_USERNAME_MIN_LENGTH = 5;
export declare const CHAT_USERNAME_MAX_LENGTH = 32;
export declare const CHAT_USERNAME_REGEX: RegExp;
/** Название чата/канала/группы (Telegram: до 255 символов) */
export declare const CHAT_TITLE_MAX_LENGTH = 255;
export declare const CHAT_DESCRIPTION_MAX_LENGTH = 255;
export declare const DISPLAY_NAME_MAX_LENGTH = 64;
export declare const BIO_MAX_LENGTH = 500;
export declare const STATUS_TEXT_MAX_LENGTH = 70;
export declare const MAX_GROUP_MEMBERS = 200000;
/** Лимит участников группы для бесплатных пользователей */
export declare const MAX_GROUP_MEMBERS_FREE = 200;
/** Лимит участников супергруппы */
export declare const MAX_SUPERGROUP_MEMBERS = 500000;
export declare const MAX_CHANNEL_SUBSCRIBERS: number;
export declare const MAX_PINNED_MESSAGES = 100;
/** Лимит закреплённых сообщений для Premium */
export declare const MAX_PINNED_MESSAGES_PREMIUM = 200;
/** Лимит тем в группе */
export declare const MAX_TOPICS_PER_GROUP = 100;
/** Максимум ботов на одного владельца */
export declare const MAX_BOTS_PER_USER = 20;
/** Лимит ботов для бесплатных пользователей */
export declare const MAX_BOTS_PER_USER_FREE = 3;
export declare const MAX_MESSAGE_TEXT_LENGTH = 4096;
export declare const MAX_CAPTION_LENGTH = 1024;
export declare const MAX_FILE_SIZE: number;
export declare const MAX_FILE_SIZE_PREMIUM: number;
/** Макс. размер одного файла в «Моей музыке» (аудио). */
export declare const MUSIC_MAX_UPLOAD_BYTES: number;
export declare const MAX_ACTIVE_SESSIONS = 10;
export declare const SELF_DESTRUCT_TIMERS: readonly [1, 2, 3, 5, 10, 15, 30, 60, 300, 3600, 86400, 604800];
/** Макс. таймер самоуничтожения для бесплатных (24 ч) */
export declare const SELF_DESTRUCT_MAX_SEC_FREE = 86400;
/** Макс. таймер самоуничтожения для Premium (7 дней) */
export declare const SELF_DESTRUCT_MAX_SEC_PREMIUM = 604800;
export declare const OTP_LENGTH = 6;
export declare const OTP_TTL_SECONDS = 300;
export declare const MAGIC_LINK_TTL_SECONDS = 600;
export declare const JWT_ACCESS_TOKEN_TTL: number;
export declare const JWT_REFRESH_TOKEN_TTL: number;
export declare const TYPING_INDICATOR_TTL_MS = 5000;
export declare const PRESENCE_HEARTBEAT_INTERVAL_MS = 30000;
export declare const PRESENCE_OFFLINE_THRESHOLD_MS = 60000;
export declare const STORY_TTL_HOURS = 24;
/** Макс. TTL историй для Premium в часах (7 дней) */
export declare const STORY_TTL_PREMIUM_MAX_HOURS = 168;
export declare const SLOW_MODE_OPTIONS: readonly [0, 10, 30, 60, 300, 900, 3600];
/** Настройки модерации по умолчанию */
export declare const DEFAULT_MODERATION_SETTINGS: {
    forbiddenWords: string[];
    forbiddenWordsMode: "warn" | "delete" | "ban";
    antiSpamEnabled: boolean;
    antiSpamMessagesLimit: number;
    antiSpamTimeWindow: number;
    antiSpamAction: "warn" | "mute" | "ban";
    linksAllowed: boolean;
    linksRequireApproval: boolean;
    captchaEnabled: boolean;
    captchaTimeout: number;
    mediaRequireApproval: boolean;
    autoDeleteSpam: boolean;
    autoBanRepeatOffenders: boolean;
};
/** Макс. число разных эмодзи (типов реакций) на одно сообщение без Premium */
export declare const MAX_REACTIONS_PER_MESSAGE = 5;
/** То же для Premium */
export declare const MAX_REACTIONS_PER_MESSAGE_PREMIUM = 10;
export declare const SUPPORTED_IMAGE_TYPES: readonly ["image/jpeg", "image/png", "image/gif", "image/webp"];
export declare const SUPPORTED_VIDEO_TYPES: readonly ["video/mp4", "video/webm", "video/quicktime"];
/** Типы медиа для стикеров и кастомных эмодзи (изображения + WebM для анимации). */
export declare const SUPPORTED_STICKER_EMOJI_TYPES: readonly ["image/jpeg", "image/png", "image/gif", "image/webp", "video/webm"];
export declare const SUPPORTED_AUDIO_TYPES: readonly ["audio/mpeg", "audio/ogg", "audio/wav", "audio/webm"];
/** Расширенный список для библиотеки музыки (m4a/aac и т.д.). */
export declare const MUSIC_LIBRARY_AUDIO_MIME_TYPES: readonly ["audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/flac"];
export declare const IMAGE_MAX_DIMENSION = 10000;
export declare const THUMBNAIL_SIZE = 320;
export declare const AVATAR_SIZE = 512;
/** Хранение истории сообщений для бесплатных (дней); null = без ограничения */
export declare const MESSAGE_RETENTION_DAYS_FREE = 365;
export declare const NATS_SUBJECTS: {
    readonly MESSAGE_INCOMING: "aluf.message.incoming";
    readonly MESSAGE_SENT: "aluf.message.sent";
    readonly MESSAGE_DELIVERED: "aluf.message.delivered";
    readonly MESSAGE_READ: "aluf.message.read";
    readonly MESSAGE_EDITED: "aluf.message.edited";
    readonly MESSAGE_DELETED: "aluf.message.deleted";
    /** Сводка реакций после add/remove (для синхронизации у всех участников чата) */
    readonly MESSAGE_REACTION: "aluf.message.reaction";
    readonly TYPING: "aluf.typing";
    readonly PRESENCE: "aluf.presence";
    readonly NOTIFICATION: "aluf.notification";
    readonly EMAIL_SEND: "aluf.email.send";
    readonly CALL_SIGNAL: "aluf.call.signal";
    readonly USER_UPDATED: "aluf.user.updated";
    readonly CHAT_UPDATED: "aluf.chat.updated";
    readonly SEARCH_INDEX: "aluf.search.index";
};
export declare const GRPC_PACKAGES: {
    readonly AUTH: "aluf.auth.v1";
    readonly USER: "aluf.user.v1";
    readonly CHAT: "aluf.chat.v1";
    readonly MESSAGE: "aluf.message.v1";
    readonly MEDIA: "aluf.media.v1";
    readonly NOTIFICATION: "aluf.notification.v1";
    readonly CALL: "aluf.call.v1";
    readonly SEARCH: "aluf.search.v1";
    readonly STORY: "aluf.story.v1";
    readonly BOT: "aluf.bot.v1";
    readonly STICKER: "aluf.sticker.v1";
    readonly CUSTOM_EMOJI: "aluf.custom_emoji.v1";
    readonly MUSIC: "aluf.music.v1";
};
//# sourceMappingURL=constants.d.ts.map