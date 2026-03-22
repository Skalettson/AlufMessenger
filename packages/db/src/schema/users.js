"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    alufId: (0, pg_core_1.bigint)('aluf_id', { mode: 'bigint' }).unique().notNull(),
    username: (0, pg_core_1.varchar)('username', { length: 32 }).unique().notNull(),
    displayName: (0, pg_core_1.varchar)('display_name', { length: 64 }).notNull(),
    phone: (0, pg_core_1.varchar)('phone', { length: 20 }).unique(),
    email: (0, pg_core_1.varchar)('email', { length: 254 }).unique(),
    emailVerified: (0, pg_core_1.boolean)('email_verified').default(false).notNull(),
    passwordHash: (0, pg_core_1.varchar)('password_hash', { length: 255 }),
    // Храним storageKey вместо полного URL для генерации presigned URL "на лету"
    avatarStorageKey: (0, pg_core_1.varchar)('avatar_storage_key', { length: 512 }),
    coverStorageKey: (0, pg_core_1.varchar)('cover_storage_key', { length: 512 }),
    // Устаревшие поля для обратной совместимости (будут удалены в будущем)
    avatarUrl: (0, pg_core_1.text)('avatar_url'),
    coverUrl: (0, pg_core_1.text)('cover_url'),
    bio: (0, pg_core_1.varchar)('bio', { length: 500 }),
    statusText: (0, pg_core_1.varchar)('status_text', { length: 70 }),
    statusEmoji: (0, pg_core_1.varchar)('status_emoji', { length: 10 }),
    premiumBadgeEmoji: (0, pg_core_1.varchar)('premium_badge_emoji', { length: 16 }),
    isPremium: (0, pg_core_1.boolean)('is_premium').default(false).notNull(),
    isVerified: (0, pg_core_1.boolean)('is_verified').default(false).notNull(),
    isOfficial: (0, pg_core_1.boolean)('is_official').default(false).notNull(),
    isAnonymous: (0, pg_core_1.boolean)('is_anonymous').default(false).notNull(),
    isBot: (0, pg_core_1.boolean)('is_bot').default(false).notNull(),
    twoFactorSecret: (0, pg_core_1.varchar)('two_factor_secret', { length: 255 }),
    twoFactorEnabled: (0, pg_core_1.boolean)('two_factor_enabled').default(false).notNull(),
    privacySettings: (0, pg_core_1.jsonb)('privacy_settings').default({}).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    lastSeenAt: (0, pg_core_1.timestamp)('last_seen_at', { withTimezone: true }),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.index)('users_username_idx').on(table.username),
    (0, pg_core_1.index)('users_aluf_id_idx').on(table.alufId),
    (0, pg_core_1.index)('users_phone_idx').on(table.phone),
    (0, pg_core_1.index)('users_email_idx').on(table.email),
]);
//# sourceMappingURL=users.js.map