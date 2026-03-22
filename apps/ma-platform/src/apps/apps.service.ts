import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, ilike, or } from 'drizzle-orm';
import { miniApps } from '@aluf/db';
import type { InferSelectModel } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider.js';

export type MiniApp = Omit<InferSelectModel<typeof miniApps>, 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AppsService {
  private readonly logger = new Logger(AppsService.name);

  constructor(@Inject(DATABASE_TOKEN) private readonly db: DrizzleDB) {}

  private rowToMiniApp(r: InferSelectModel<typeof miniApps>): MiniApp {
    return {
      id: r.id,
      name: r.name,
      version: r.version,
      description: r.description,
      icon: r.icon,
      category: r.category,
      url: r.url,
      settings: (r.settings ?? {}) as Record<string, unknown>,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async create(app: Omit<MiniApp, 'id' | 'createdAt' | 'updatedAt'>): Promise<MiniApp> {
    const [row] = await this.db
      .insert(miniApps)
      .values({
        name: app.name,
        version: app.version,
        description: app.description ?? null,
        icon: app.icon ?? null,
        category: app.category,
        url: app.url,
        settings: app.settings ?? {},
        status: app.status,
        updatedAt: new Date(),
      })
      .returning();

    if (!row) throw new Error('Failed to create mini app');
    this.logger.log(`App created: ${row.id}`);
    return this.rowToMiniApp(row);
  }

  async findById(id: string): Promise<MiniApp | null> {
    const [row] = await this.db.select().from(miniApps).where(eq(miniApps.id, id)).limit(1);
    return row ? this.rowToMiniApp(row) : null;
  }

  async findAll(): Promise<MiniApp[]> {
    const rows = await this.db.select().from(miniApps).orderBy(miniApps.createdAt);
    return rows.map((r) => this.rowToMiniApp(r));
  }

  async update(
    id: string,
    updates: Partial<
      Pick<MiniApp, 'name' | 'version' | 'description' | 'icon' | 'category' | 'url' | 'settings' | 'status'>
    >,
  ): Promise<MiniApp | null> {
    const [row] = await this.db
      .update(miniApps)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(miniApps.id, id))
      .returning();

    if (!row) return null;
    this.logger.log(`App updated: ${id}`);
    return this.rowToMiniApp(row);
  }

  async delete(id: string): Promise<boolean> {
    const del = await this.db.delete(miniApps).where(eq(miniApps.id, id)).returning({ id: miniApps.id });
    if (del.length) this.logger.log(`App deleted: ${id}`);
    return del.length > 0;
  }

  async findByCategory(category: string): Promise<MiniApp[]> {
    const rows = await this.db
      .select()
      .from(miniApps)
      .where(eq(miniApps.category, category))
      .orderBy(miniApps.createdAt);
    return rows.map((r) => this.rowToMiniApp(r));
  }

  async search(query: string): Promise<MiniApp[]> {
    const q = `%${query.trim()}%`;
    const rows = await this.db
      .select()
      .from(miniApps)
      .where(
        or(ilike(miniApps.name, q), ilike(miniApps.description, q), ilike(miniApps.category, q)),
      )
      .orderBy(miniApps.createdAt);
    return rows.map((r) => this.rowToMiniApp(r));
  }
}
