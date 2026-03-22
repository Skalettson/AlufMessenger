import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { chatMembers, chats } from '@aluf/db';
import { DATABASE_TOKEN, type DrizzleDB } from '../../providers/database.provider';

@Injectable()
export class MemberManagementRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: DrizzleDB) {}

  async addMembers(chatId: string, userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return;
    const existing = await this.db
      .select({ userId: chatMembers.userId })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), inArray(chatMembers.userId, uniqueIds)));
    const existingSet = new Set(existing.map((e) => e.userId));
    const toInsert = uniqueIds
      .filter((id) => !existingSet.has(id))
      .map((userId) => ({ chatId, userId, role: 'member' as const, permissions: {} }));
    if (toInsert.length > 0) {
      await this.db.insert(chatMembers).values(toInsert);
      await this.db
        .update(chats)
        .set({ memberCount: sql`${chats.memberCount} + ${toInsert.length}`, updatedAt: new Date() })
        .where(eq(chats.id, chatId));
    }
  }

  async removeMember(chatId: string, userId: string) {
    await this.db
      .delete(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
    await this.db
      .update(chats)
      .set({ memberCount: sql`GREATEST(${chats.memberCount} - 1, 0)`, updatedAt: new Date() })
      .where(eq(chats.id, chatId));
  }

  async updateRole(chatId: string, userId: string, role: 'member' | 'admin' | 'owner') {
    await this.db
      .update(chatMembers)
      .set({ role })
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
  }
}
