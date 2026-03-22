"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatAuditLogs = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const chats_1 = require("./chats");
/** Журнал действий администраторов (Audit Log) */
exports.chatAuditLogs = (0, pg_core_1.pgTable)('chat_audit_logs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    chatId: (0, pg_core_1.uuid)('chat_id')
        .references(() => chats_1.chats.id)
        .notNull(),
    actorId: (0, pg_core_1.uuid)('actor_id')
        .references(() => users_1.users.id)
        .notNull(),
    action: (0, pg_core_1.varchar)('action', { length: 50 }).notNull(),
    targetUserId: (0, pg_core_1.uuid)('target_user_id').references(() => users_1.users.id),
    targetMessageId: (0, pg_core_1.uuid)('target_message_id'),
    details: (0, pg_core_1.jsonb)('details').default({}),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    userAgent: (0, pg_core_1.text)('user_agent'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true })
        .default((0, drizzle_orm_1.sql) `now()`)
        .notNull(),
}, (table) => [
    (0, pg_core_1.index)('chat_audit_logs_chat_id_idx').on(table.chatId),
    (0, pg_core_1.index)('chat_audit_logs_actor_id_idx').on(table.actorId),
    (0, pg_core_1.index)('chat_audit_logs_action_idx').on(table.action),
    (0, pg_core_1.index)('chat_audit_logs_created_at_idx').on(table.createdAt),
]);
//# sourceMappingURL=chat-audit-logs.js.map