import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    alufId: bigint('aluf_id', { mode: 'bigint' }).unique().notNull(),
    username: varchar('username', { length: 32 }).unique().notNull(),
    displayName: varchar('display_name', { length: 64 }).notNull(),
    phone: varchar('phone', { length: 20 }).unique(),
    email: varchar('email', { length: 254 }).unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    // Храним storageKey вместо полного URL для генерации presigned URL "на лету"
    avatarStorageKey: varchar('avatar_storage_key', { length: 512 }),
    coverStorageKey: varchar('cover_storage_key', { length: 512 }),
    // Устаревшие поля для обратной совместимости (будут удалены в будущем)
    avatarUrl: text('avatar_url'),
    coverUrl: text('cover_url'),
    bio: varchar('bio', { length: 500 }),
    statusText: varchar('status_text', { length: 70 }),
    statusEmoji: varchar('status_emoji', { length: 10 }),
    premiumBadgeEmoji: varchar('premium_badge_emoji', { length: 16 }),
    isPremium: boolean('is_premium').default(false).notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    isOfficial: boolean('is_official').default(false).notNull(),
    isAnonymous: boolean('is_anonymous').default(false).notNull(),
    isBot: boolean('is_bot').default(false).notNull(),
    twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
    twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
    privacySettings: jsonb('privacy_settings').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index('users_username_idx').on(table.username),
    index('users_aluf_id_idx').on(table.alufId),
    index('users_phone_idx').on(table.phone),
    index('users_email_idx').on(table.email),
  ],
);
