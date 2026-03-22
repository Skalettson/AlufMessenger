"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatModerationSettings = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const chats_1 = require("./chats");
/** Настройки модерации для групп */
exports.chatModerationSettings = (0, pg_core_1.pgTable)('chat_moderation_settings', {
    chatId: (0, pg_core_1.uuid)('chat_id')
        .primaryKey()
        .references(() => chats_1.chats.id)
        .notNull(),
    // Фильтр запрещённых слов
    forbiddenWords: (0, pg_core_1.text)('forbidden_words').array(),
    forbiddenWordsMode: (0, pg_core_1.varchar)('forbidden_words_mode', { length: 20 }).default('warn'), // warn, delete, ban
    // Анти-спам
    antiSpamEnabled: (0, pg_core_1.boolean)('anti_spam_enabled').default(false).notNull(),
    antiSpamMessagesLimit: (0, pg_core_1.integer)('anti_spam_messages_limit').default(5), // сообщений в
    antiSpamTimeWindow: (0, pg_core_1.integer)('anti_spam_time_window').default(10), // секунд
    antiSpamAction: (0, pg_core_1.varchar)('anti_spam_action', { length: 20 }).default('warn'), // warn, mute, ban
    // Ссылки
    linksAllowed: (0, pg_core_1.boolean)('links_allowed').default(true).notNull(),
    linksRequireApproval: (0, pg_core_1.boolean)('links_require_approval').default(false),
    // CAPTCHA
    captchaEnabled: (0, pg_core_1.boolean)('captcha_enabled').default(false).notNull(),
    captchaTimeout: (0, pg_core_1.integer)('captcha_timeout').default(300), // секунд на прохождение
    // Медиа
    mediaRequireApproval: (0, pg_core_1.boolean)('media_require_approval').default(false),
    // Автомодерация
    autoDeleteSpam: (0, pg_core_1.boolean)('auto_delete_spam').default(false),
    autoBanRepeatOffenders: (0, pg_core_1.boolean)('auto_ban_repeat_offenders').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.index)('chat_moderation_settings_chat_id_idx').on(table.chatId),
]);
//# sourceMappingURL=chat-moderation-settings.js.map