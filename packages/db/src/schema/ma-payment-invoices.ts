import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  index,
} from 'drizzle-orm/pg-core';

/** Счета Mini-Apps (MA Platform / payments). */
export const maPaymentInvoices = pgTable(
  'ma_payment_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: varchar('app_id', { length: 128 }).notNull(),
    userId: varchar('user_id', { length: 128 }).notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    description: text('description').notNull().default(''),
    amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('RUB'),
    payload: varchar('payload', { length: 512 }),
    /** pending | paid | failed | refunded */
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    url: varchar('url', { length: 2048 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (table) => [
    index('ma_payment_invoices_app_user_idx').on(table.appId, table.userId),
    index('ma_payment_invoices_status_idx').on(table.status),
    index('ma_payment_invoices_created_idx').on(table.createdAt),
  ],
);
