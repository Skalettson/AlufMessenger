import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { chats } from './chats';

/** Настройки модерации для групп */
export const chatModerationSettings = pgTable(
  'chat_moderation_settings',
  {
    chatId: uuid('chat_id')
      .primaryKey()
      .references(() => chats.id)
      .notNull(),
    // Фильтр запрещённых слов
    forbiddenWords: text('forbidden_words').array(),
    forbiddenWordsMode: varchar('forbidden_words_mode', { length: 20 }).default('warn'), // warn, delete, ban
    // Анти-спам
    antiSpamEnabled: boolean('anti_spam_enabled').default(false).notNull(),
    antiSpamMessagesLimit: integer('anti_spam_messages_limit').default(5), // сообщений в
    antiSpamTimeWindow: integer('anti_spam_time_window').default(10), // секунд
    antiSpamAction: varchar('anti_spam_action', { length: 20 }).default('warn'), // warn, mute, ban
    // Ссылки
    linksAllowed: boolean('links_allowed').default(true).notNull(),
    linksRequireApproval: boolean('links_require_approval').default(false),
    // CAPTCHA
    captchaEnabled: boolean('captcha_enabled').default(false).notNull(),
    captchaTimeout: integer('captcha_timeout').default(300), // секунд на прохождение
    // Медиа
    mediaRequireApproval: boolean('media_require_approval').default(false),
    // Автомодерация
    autoDeleteSpam: boolean('auto_delete_spam').default(false),
    autoBanRepeatOffenders: boolean('auto_ban_repeat_offenders').default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('chat_moderation_settings_chat_id_idx').on(table.chatId),
  ],
);
