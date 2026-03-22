import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { calls } from './calls';
import { users } from './users';

export const callParticipants = pgTable(
  'call_participants',
  {
    callId: uuid('call_id')
      .references(() => calls.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    leftAt: timestamp('left_at', { withTimezone: true }),
    isMuted: boolean('is_muted').default(false).notNull(),
    isVideoEnabled: boolean('is_video_enabled').default(false).notNull(),
    isScreenSharing: boolean('is_screen_sharing').default(false).notNull(),
  },
  (table) => [primaryKey({ columns: [table.callId, table.userId] })],
);
