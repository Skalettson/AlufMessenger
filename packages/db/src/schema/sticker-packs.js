"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stickerPacks = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.stickerPacks = (0, pg_core_1.pgTable)('sticker_packs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 128 }).notNull(),
    isPremium: (0, pg_core_1.boolean)('is_premium').default(false).notNull(),
    creatorId: (0, pg_core_1.uuid)('creator_id').references(() => users_1.users.id),
    isPublic: (0, pg_core_1.boolean)('is_public').default(true).notNull(),
    coverMediaId: (0, pg_core_1.uuid)('cover_media_id'),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
});
//# sourceMappingURL=sticker-packs.js.map