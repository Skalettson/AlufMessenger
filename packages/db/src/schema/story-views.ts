import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { stories } from './stories';
import { users } from './users';

export const storyViews = pgTable(
  'story_views',
  {
    storyId: uuid('story_id')
      .references(() => stories.id)
      .notNull(),
    viewerId: uuid('viewer_id')
      .references(() => users.id)
      .notNull(),
    reaction: varchar('reaction', { length: 10 }),
    viewedAt: timestamp('viewed_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.storyId, table.viewerId] })],
);
