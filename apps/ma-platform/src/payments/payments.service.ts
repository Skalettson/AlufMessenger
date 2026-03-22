import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, desc, sql } from 'drizzle-orm';
import { maPaymentInvoices } from '@aluf/db';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider.js';

export interface Invoice {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  payload?: string;
  url: string;
  appId: string;
  userId: string;
  createdAt: Date;
  paidAt?: Date;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(@Inject(DATABASE_TOKEN) private readonly db: DrizzleDB) {}

  private rowToInvoice(r: typeof maPaymentInvoices.$inferSelect): Invoice {
    const amount =
      typeof r.amount === 'string' ? parseFloat(r.amount) : Number(r.amount);
    return {
      id: r.id,
      appId: r.appId,
      userId: r.userId,
      title: r.title,
      description: r.description,
      amount: Number.isFinite(amount) ? amount : 0,
      currency: r.currency,
      status: r.status as Invoice['status'],
      payload: r.payload ?? undefined,
      url: r.url,
      createdAt: r.createdAt,
      paidAt: r.paidAt ?? undefined,
    };
  }

  async createInvoice(data: {
    appId: string;
    userId: string;
    title: string;
    description: string;
    amount: number;
    currency: string;
    payload?: string;
  }): Promise<Invoice> {
    const baseUrl =
      process.env.MA_PAYMENT_INVOICE_URL_BASE?.replace(/\/$/, '') ||
      'https://pay.aluf.app/invoice';
    const slug = data.payload?.trim() || randomUUID();
    const url = `${baseUrl}/${encodeURIComponent(slug)}`;

    const [row] = await this.db
      .insert(maPaymentInvoices)
      .values({
        appId: data.appId,
        userId: data.userId,
        title: data.title,
        description: data.description ?? '',
        amount: String(data.amount),
        currency: data.currency,
        payload: data.payload ?? null,
        status: 'pending',
        url,
        createdAt: new Date(),
      })
      .returning();

    if (!row) throw new Error('Failed to create invoice');
    this.logger.log(`Invoice created: ${row.id} for ${data.amount} ${data.currency}`);
    return this.rowToInvoice(row);
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const [row] = await this.db
      .select()
      .from(maPaymentInvoices)
      .where(eq(maPaymentInvoices.id, id))
      .limit(1);
    return row ? this.rowToInvoice(row) : null;
  }

  async payInvoice(id: string): Promise<Invoice | null> {
    const existing = await this.getInvoice(id);
    if (!existing) return null;

    const [row] = await this.db
      .update(maPaymentInvoices)
      .set({
        status: 'paid',
        paidAt: new Date(),
      })
      .where(eq(maPaymentInvoices.id, id))
      .returning();

    if (!row) return null;
    this.logger.log(`Invoice paid: ${id}`);
    return this.rowToInvoice(row);
  }

  async refundInvoice(id: string): Promise<Invoice | null> {
    const existing = await this.getInvoice(id);
    if (!existing) return null;

    const [row] = await this.db
      .update(maPaymentInvoices)
      .set({ status: 'refunded' })
      .where(eq(maPaymentInvoices.id, id))
      .returning();

    if (!row) return null;
    this.logger.log(`Invoice refunded: ${id}`);
    return this.rowToInvoice(row);
  }

  async getInvoicesByUser(userId: string): Promise<Invoice[]> {
    const rows = await this.db
      .select()
      .from(maPaymentInvoices)
      .where(eq(maPaymentInvoices.userId, userId))
      .orderBy(desc(maPaymentInvoices.createdAt));
    return rows.map((r) => this.rowToInvoice(r));
  }

  /** Агрегаты для панели разработчика (все счета). */
  async getDashboardOverview(limit = 50) {
    const [totals] = await this.db
      .select({
        total: sql<number>`count(*)::int`.mapWith(Number),
        pending:
          sql<number>`count(*) filter (where ${maPaymentInvoices.status} = 'pending')::int`.mapWith(
            Number,
          ),
        paid: sql<number>`count(*) filter (where ${maPaymentInvoices.status} = 'paid')::int`.mapWith(
          Number,
        ),
        failed:
          sql<number>`count(*) filter (where ${maPaymentInvoices.status} = 'failed')::int`.mapWith(
            Number,
          ),
        refunded:
          sql<number>`count(*) filter (where ${maPaymentInvoices.status} = 'refunded')::int`.mapWith(
            Number,
          ),
      })
      .from(maPaymentInvoices);

    const [paidSumRow] = await this.db
      .select({
        s: sql<string>`coalesce(sum(${maPaymentInvoices.amount}), 0)::text`,
      })
      .from(maPaymentInvoices)
      .where(eq(maPaymentInvoices.status, 'paid'));

    const recent = await this.db
      .select()
      .from(maPaymentInvoices)
      .orderBy(desc(maPaymentInvoices.createdAt))
      .limit(limit);

    const paidSum = parseFloat(paidSumRow?.s ?? '0') || 0;

    return {
      counts: {
        total: totals?.total ?? 0,
        pending: totals?.pending ?? 0,
        paid: totals?.paid ?? 0,
        failed: totals?.failed ?? 0,
        refunded: totals?.refunded ?? 0,
      },
      paidAmountTotal: paidSum,
      recent: recent.map((r) => ({
        ...this.rowToInvoice(r),
        createdAt: r.createdAt.toISOString(),
        paidAt: r.paidAt?.toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}
