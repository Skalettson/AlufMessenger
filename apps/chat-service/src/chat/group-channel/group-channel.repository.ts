import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { chats, chatMembers } from '@aluf/db';
import { DATABASE_TOKEN, type DrizzleDB } from '../../providers/database.provider';
import type { CreateGroupChannelInput, GroupChannelPermissions } from './domain';

@Injectable()
export class GroupChannelRepository {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: DrizzleDB) {}

  async create(input: CreateGroupChannelInput, ownerPermissions: GroupChannelPermissions) {
    const [chat] = await this.db
      .insert(chats)
      .values({
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        avatarUrl: input.avatarUrl ?? null,
        username: input.username ?? null,
        createdBy: input.creatorId,
        memberCount: input.type === 'channel' ? 1 : Math.max(1, new Set([input.creatorId, ...(input.memberIds ?? [])]).size),
      })
      .returning();

    const members = input.type === 'channel'
      ? [{ chatId: chat.id, userId: input.creatorId, role: 'owner' as const, permissions: ownerPermissions }]
      : [...new Set([input.creatorId, ...(input.memberIds ?? [])])].map((userId) => ({
          chatId: chat.id,
          userId,
          role: (userId === input.creatorId ? 'owner' : 'member') as 'owner' | 'member',
          permissions: userId === input.creatorId ? ownerPermissions : {},
        }));

    if (members.length > 0) {
      await this.db.insert(chatMembers).values(members);
    }

    return chat;
  }

  async setMuted(chatId: string, userId: string, mutedUntil: Date | null) {
    await this.db
      .update(chatMembers)
      .set({ mutedUntil })
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
  }

  async setArchived(chatId: string, userId: string, archived: boolean) {
    await this.db
      .update(chatMembers)
      .set({ isArchived: archived } as { isArchived: boolean })
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
  }
}
