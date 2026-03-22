"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaFiles = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const sticker_packs_1 = require("./sticker-packs");
exports.mediaFiles = (0, pg_core_1.pgTable)('media_files', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    uploaderId: (0, pg_core_1.uuid)('uploader_id')
        .references(() => users_1.users.id)
        .notNull(),
    fileName: (0, pg_core_1.varchar)('file_name', { length: 255 }).notNull(),
    mimeType: (0, pg_core_1.varchar)('mime_type', { length: 127 }).notNull(),
    sizeBytes: (0, pg_core_1.bigint)('size_bytes', { mode: 'bigint' }).notNull(),
    storageKey: (0, pg_core_1.varchar)('storage_key', { length: 512 }).notNull(),
    thumbnailKey: (0, pg_core_1.varchar)('thumbnail_key', { length: 512 }),
    stickerPackId: (0, pg_core_1.uuid)('sticker_pack_id').references(() => sticker_packs_1.stickerPacks.id),
    metadata: (0, pg_core_1.jsonb)('metadata').default({}).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
});
//# sourceMappingURL=media-files.js.map