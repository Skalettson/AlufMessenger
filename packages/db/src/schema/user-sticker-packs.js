"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userStickerPacks = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const sticker_packs_1 = require("./sticker-packs");
exports.userStickerPacks = (0, pg_core_1.pgTable)('user_sticker_packs', {
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id, { onDelete: 'cascade' })
        .notNull(),
    stickerPackId: (0, pg_core_1.uuid)('sticker_pack_id')
        .references(() => sticker_packs_1.stickerPacks.id, { onDelete: 'cascade' })
        .notNull(),
    addedAt: (0, pg_core_1.timestamp)('added_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.userId, table.stickerPackId] }),
]);
//# sourceMappingURL=user-sticker-packs.js.map