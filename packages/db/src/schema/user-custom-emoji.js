"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userCustomEmoji = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const custom_emoji_1 = require("./custom-emoji");
exports.userCustomEmoji = (0, pg_core_1.pgTable)('user_custom_emoji', {
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id, { onDelete: 'cascade' })
        .notNull(),
    customEmojiId: (0, pg_core_1.uuid)('custom_emoji_id')
        .references(() => custom_emoji_1.customEmoji.id, { onDelete: 'cascade' })
        .notNull(),
    addedAt: (0, pg_core_1.timestamp)('added_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.userId, table.customEmojiId] }),
]);
//# sourceMappingURL=user-custom-emoji.js.map