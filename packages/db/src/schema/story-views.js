"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storyViews = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const stories_1 = require("./stories");
const users_1 = require("./users");
exports.storyViews = (0, pg_core_1.pgTable)('story_views', {
    storyId: (0, pg_core_1.uuid)('story_id')
        .references(() => stories_1.stories.id)
        .notNull(),
    viewerId: (0, pg_core_1.uuid)('viewer_id')
        .references(() => users_1.users.id)
        .notNull(),
    reaction: (0, pg_core_1.varchar)('reaction', { length: 10 }),
    viewedAt: (0, pg_core_1.timestamp)('viewed_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [(0, pg_core_1.primaryKey)({ columns: [table.storyId, table.viewerId] })]);
//# sourceMappingURL=story-views.js.map