"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callParticipants = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const calls_1 = require("./calls");
const users_1 = require("./users");
exports.callParticipants = (0, pg_core_1.pgTable)('call_participants', {
    callId: (0, pg_core_1.uuid)('call_id')
        .references(() => calls_1.calls.id)
        .notNull(),
    userId: (0, pg_core_1.uuid)('user_id')
        .references(() => users_1.users.id)
        .notNull(),
    joinedAt: (0, pg_core_1.timestamp)('joined_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
    leftAt: (0, pg_core_1.timestamp)('left_at', { withTimezone: true }),
    isMuted: (0, pg_core_1.boolean)('is_muted').default(false).notNull(),
    isVideoEnabled: (0, pg_core_1.boolean)('is_video_enabled').default(false).notNull(),
    isScreenSharing: (0, pg_core_1.boolean)('is_screen_sharing').default(false).notNull(),
}, (table) => [(0, pg_core_1.primaryKey)({ columns: [table.callId, table.userId] })]);
//# sourceMappingURL=call-participants.js.map