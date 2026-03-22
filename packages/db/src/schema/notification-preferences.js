"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationPreferences = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.notificationPreferences = (0, pg_core_1.pgTable)('notification_preferences', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull()
        .unique(),
    messagesEnabled: (0, pg_core_1.boolean)('messages_enabled').default(true).notNull(),
    mentionsEnabled: (0, pg_core_1.boolean)('mentions_enabled').default(true).notNull(),
    reactionsEnabled: (0, pg_core_1.boolean)('reactions_enabled').default(true).notNull(),
    callsEnabled: (0, pg_core_1.boolean)('calls_enabled').default(true).notNull(),
    groupInvitesEnabled: (0, pg_core_1.boolean)('group_invites_enabled').default(true).notNull(),
    contactJoinedEnabled: (0, pg_core_1.boolean)('contact_joined_enabled').default(true).notNull(),
    storiesEnabled: (0, pg_core_1.boolean)('stories_enabled').default(true).notNull(),
    showPreview: (0, pg_core_1.boolean)('show_preview').default(true).notNull(),
    defaultSound: (0, pg_core_1.varchar)('default_sound', { length: 64 }).default('default'),
    vibrate: (0, pg_core_1.boolean)('vibrate').default(true).notNull(),
    ledEnabled: (0, pg_core_1.boolean)('led_enabled').default(true).notNull(),
    ledColor: (0, pg_core_1.varchar)('led_color', { length: 16 }).default('#ffffff'),
    chatOverrides: (0, pg_core_1.jsonb)('chat_overrides').default([]).notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [(0, pg_core_1.uniqueIndex)('notification_preferences_user_id_idx').on(table.userId)]);
//# sourceMappingURL=notification-preferences.js.map