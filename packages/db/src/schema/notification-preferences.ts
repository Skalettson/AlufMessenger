import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  boolean,
  varchar,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull()
      .unique(),
    messagesEnabled: boolean('messages_enabled').default(true).notNull(),
    mentionsEnabled: boolean('mentions_enabled').default(true).notNull(),
    reactionsEnabled: boolean('reactions_enabled').default(true).notNull(),
    callsEnabled: boolean('calls_enabled').default(true).notNull(),
    groupInvitesEnabled: boolean('group_invites_enabled').default(true).notNull(),
    contactJoinedEnabled: boolean('contact_joined_enabled').default(true).notNull(),
    storiesEnabled: boolean('stories_enabled').default(true).notNull(),
    showPreview: boolean('show_preview').default(true).notNull(),
    defaultSound: varchar('default_sound', { length: 64 }).default('default'),
    vibrate: boolean('vibrate').default(true).notNull(),
    ledEnabled: boolean('led_enabled').default(true).notNull(),
    ledColor: varchar('led_color', { length: 16 }).default('#ffffff'),
    chatOverrides: jsonb('chat_overrides').default([]).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [uniqueIndex('notification_preferences_user_id_idx').on(table.userId)],
);
