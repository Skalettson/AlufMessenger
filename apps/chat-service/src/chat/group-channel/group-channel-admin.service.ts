import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  chatAuditLogs,
  chatBans,
  chatMembers,
  chatModerationSettings,
  chatTopics,
  chats,
  inviteLinks,
  messageStatus,
  messages,
  reactions,
  users,
} from '@aluf/db';
import {
  BadRequestError,
  ConflictError,
  DEFAULT_MODERATION_SETTINGS,
  DEFAULT_PAGE_SIZE,
  ForbiddenError,
  NATS_SUBJECTS,
  NotFoundError,
  clampPageSize,
} from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../../providers/database.provider';
import { NATS_TOKEN, type NatsConnection } from '../../providers/nats.provider';
import { StringCodec } from 'nats';
import type { MemberPermissions } from '@aluf/shared';

function pickUserAvatarUrl(
  avatarStorageKey: string | null | undefined,
  avatarUrl: string | null | undefined,
): string | null {
  const a = (avatarStorageKey ?? '').trim();
  if (a) {
    if (/^https?:\/\//i.test(a)) return a;
    if (a.startsWith('/')) return a;
    if (/^\d{4}\/\d{2}\/\d{2}\//.test(a)) return `/${a}`;
    return a;
  }
  const b = (avatarUrl ?? '').trim();
  return b || null;
}

@Injectable()
export class GroupChannelAdminService {
  private readonly sc = StringCodec();

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    @Inject(NATS_TOKEN) private readonly nats: NatsConnection,
  ) {}

  private publish(subject: string, data: unknown): void {
    this.nats.publish(subject, this.sc.encode(JSON.stringify(data)));
  }

  private async getMember(chatId: string, userId: string) {
    const [member] = await this.db
      .select()
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
      .limit(1);
    return member ?? null;
  }

  private async requirePermission(chatId: string, userId: string, permission: keyof MemberPermissions) {
    const member = await this.getMember(chatId, userId);
    if (!member) throw new ForbiddenError('Not a member of this chat');
    if (member.role === 'owner' || member.role === 'admin') return;
    const perms = (member.permissions ?? {}) as MemberPermissions;
    if (!perms[permission]) throw new ForbiddenError('Insufficient permissions');
  }

  private async logAuditAction(
    chatId: string,
    actorId: string,
    action: string,
    targetUserId: string | null,
    details: Record<string, unknown> = {},
  ) {
    await this.db.insert(chatAuditLogs).values({
      chatId,
      actorId,
      action,
      targetUserId: targetUserId || null,
      details,
    });
  }

  async createInviteLink(chatId: string, createdBy: string, maxUses?: number, expiresAt?: Date) {
    await this.requirePermission(chatId, createdBy, 'canInviteMembers');
    const { nanoid } = await import('nanoid');
    const code = nanoid(16);
    const [link] = await this.db
      .insert(inviteLinks)
      .values({
        chatId,
        createdBy,
        code,
        usageLimit: maxUses ?? null,
        expiresAt: expiresAt ?? null,
      })
      .returning();
    return link;
  }

  async getChatByInviteLink(code: string) {
    const [link] = await this.db
      .select()
      .from(inviteLinks)
      .where(eq(inviteLinks.code, code))
      .limit(1);
    if (!link) throw new NotFoundError('Invite link not found');
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new BadRequestError('Invite link has expired');
    }
    const [chat] = await this.db.select().from(chats).where(eq(chats.id, link.chatId)).limit(1);
    if (!chat) throw new NotFoundError('Chat not found');
    return chat;
  }

  async linkDiscussionGroup(channelId: string, groupId: string, userId: string) {
    const [channel] = await this.db
      .select({ type: chats.type })
      .from(chats)
      .where(eq(chats.id, channelId))
      .limit(1);
    if (!channel) throw new NotFoundError('Channel', channelId);
    if (channel.type !== 'channel') throw new BadRequestError('This chat is not a channel');

    const [group] = await this.db
      .select({ type: chats.type })
      .from(chats)
      .where(eq(chats.id, groupId))
      .limit(1);
    if (!group) throw new NotFoundError('Group', groupId);
    if (group.type !== 'group' && group.type !== 'secret') {
      throw new BadRequestError('Can only link a group or secret chat');
    }

    await this.requirePermission(channelId, userId, 'canEditInfo');
    const [groupMember] = await this.db
      .select({ role: chatMembers.role })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, groupId), eq(chatMembers.userId, userId)))
      .limit(1);
    if (!groupMember || (groupMember.role !== 'owner' && groupMember.role !== 'admin')) {
      throw new ForbiddenError('You must be an admin of the group to link it');
    }

    const [existingLink] = await this.db
      .select({ id: chats.id })
      .from(chats)
      .where(and(eq(chats.linkedDiscussionChatId, groupId), sql`${chats.id} <> ${channelId}`))
      .limit(1);
    if (existingLink) throw new ConflictError('This group is already linked to another channel');

    const [updated] = await this.db
      .update(chats)
      .set({ linkedDiscussionChatId: groupId, updatedAt: new Date() })
      .where(eq(chats.id, channelId))
      .returning();

    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'channel.discussion_linked', channelId, groupId });
    return updated;
  }

  async unlinkDiscussionGroup(channelId: string, userId: string) {
    const [channel] = await this.db
      .select({ type: chats.type, linkedDiscussionChatId: chats.linkedDiscussionChatId })
      .from(chats)
      .where(eq(chats.id, channelId))
      .limit(1);
    if (!channel) throw new NotFoundError('Channel', channelId);
    if (channel.type !== 'channel') throw new BadRequestError('This chat is not a channel');
    if (!channel.linkedDiscussionChatId) throw new BadRequestError('No discussion group is linked');

    await this.requirePermission(channelId, userId, 'canEditInfo');
    const [updated] = await this.db
      .update(chats)
      .set({ linkedDiscussionChatId: null, updatedAt: new Date() })
      .where(eq(chats.id, channelId))
      .returning();
    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'channel.discussion_unlinked', channelId });
    return updated;
  }

  async banMember(
    chatId: string,
    bannedBy: string,
    userId: string,
    reason: string,
    expiresAt: Date | null,
    deleteMessages: boolean,
  ) {
    await this.requirePermission(chatId, bannedBy, 'canBanMembers');
    const targetMember = await this.getMember(chatId, userId);
    if (!targetMember) throw new NotFoundError('Member not found');
    if (targetMember.role === 'owner') throw new ForbiddenError('Cannot ban the chat owner');
    const actorMember = await this.getMember(chatId, bannedBy);
    if (actorMember && targetMember.role === 'admin' && actorMember.role !== 'owner') {
      throw new ForbiddenError('Only the owner can ban admins');
    }

    await this.db.transaction(async (tx) => {
      await tx.insert(chatBans).values({ chatId, userId, bannedBy, reason: reason || null, expiresAt });
      if (deleteMessages) {
        const recentMessages = await tx
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.chatId, chatId), eq(messages.senderId, userId)))
          .limit(100);
        const messageIds = recentMessages.map((m) => m.id);
        if (messageIds.length > 0) {
          await tx.delete(reactions).where(inArray(reactions.messageId, messageIds));
          await tx.delete(messageStatus).where(inArray(messageStatus.messageId, messageIds));
          await tx.delete(messages).where(inArray(messages.id, messageIds));
        }
      }
      await tx.delete(chatMembers).where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
      await tx.update(chats).set({ memberCount: sql`${chats.memberCount} - 1` }).where(eq(chats.id, chatId));
    });

    await this.logAuditAction(chatId, bannedBy, 'member_banned', userId, { reason, expiresAt, deleteMessages });
    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'member.banned', chatId, userId, bannedBy });
  }

  async unbanMember(chatId: string, unbannedBy: string, userId: string) {
    await this.requirePermission(chatId, unbannedBy, 'canBanMembers');
    const [ban] = await this.db
      .select()
      .from(chatBans)
      .where(and(eq(chatBans.chatId, chatId), eq(chatBans.userId, userId)))
      .limit(1);
    if (!ban) throw new NotFoundError('Ban record not found');
    await this.db.delete(chatBans).where(and(eq(chatBans.chatId, chatId), eq(chatBans.userId, userId)));
    await this.logAuditAction(chatId, unbannedBy, 'member_unbanned', userId);
    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'member.unbanned', chatId, userId });
  }

  async getBannedMembers(chatId: string, limit: number, offset: number) {
    const pageSize = clampPageSize(limit || DEFAULT_PAGE_SIZE);
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatBans)
      .where(eq(chatBans.chatId, chatId));
    const totalCount = countResult?.count ?? 0;

    const bans = await this.db
      .select({
        chatId: chatBans.chatId,
        userId: chatBans.userId,
        bannedBy: chatBans.bannedBy,
        reason: chatBans.reason,
        expiresAt: chatBans.expiresAt,
        createdAt: chatBans.createdAt,
      })
      .from(chatBans)
      .where(eq(chatBans.chatId, chatId))
      .limit(pageSize)
      .offset(offset ?? 0);

    const userIds = [...new Set([...bans.map((b) => b.userId), ...bans.map((b) => b.bannedBy)])];
    const userList = userIds.length === 0
      ? []
      : await this.db
          .select({
            id: users.id,
            displayName: users.displayName,
            avatarStorageKey: users.avatarStorageKey,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(inArray(users.id, userIds));
    const userMap = Object.fromEntries(userList.map((u) => [u.id, u]));

    return {
      members: bans.map((b) => ({
        ...b,
        displayName: userMap[b.userId]?.displayName ?? null,
        avatarUrl: userMap[b.userId]
          ? pickUserAvatarUrl(userMap[b.userId]!.avatarStorageKey, userMap[b.userId]!.avatarUrl)
          : null,
        bannedByDisplayName: userMap[b.bannedBy]?.displayName ?? null,
      })),
      totalCount,
    };
  }

  async getAuditLog(chatId: string, limit: number, offset: number, actionFilter?: string) {
    const pageSize = clampPageSize(limit || DEFAULT_PAGE_SIZE);
    const conditions: Array<ReturnType<typeof eq>> = [eq(chatAuditLogs.chatId, chatId)];
    if (actionFilter) conditions.push(eq(chatAuditLogs.action, actionFilter));

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatAuditLogs)
      .where(and(...conditions));
    const totalCount = countResult?.count ?? 0;

    const logs = await this.db
      .select({
        id: chatAuditLogs.id,
        chatId: chatAuditLogs.chatId,
        actorId: chatAuditLogs.actorId,
        action: chatAuditLogs.action,
        targetUserId: chatAuditLogs.targetUserId,
        details: chatAuditLogs.details,
        createdAt: chatAuditLogs.createdAt,
      })
      .from(chatAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(chatAuditLogs.createdAt))
      .limit(pageSize)
      .offset(offset ?? 0);

    const userIds = [
      ...new Set([...logs.map((l) => l.actorId), ...logs.map((l) => l.targetUserId).filter((id): id is string => !!id)]),
    ];
    const userList = userIds.length === 0
      ? []
      : await this.db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, userIds));
    const userMap = Object.fromEntries(userList.map((u) => [u.id, u.displayName]));

    return {
      entries: logs.map((l) => ({
        ...l,
        actorName: userMap[l.actorId] ?? null,
        targetUserName: l.targetUserId ? (userMap[l.targetUserId] ?? null) : null,
      })),
      totalCount,
    };
  }

  async getModerationSettings(chatId: string) {
    const [settings] = await this.db
      .select()
      .from(chatModerationSettings)
      .where(eq(chatModerationSettings.chatId, chatId))
      .limit(1);
    if (!settings) return DEFAULT_MODERATION_SETTINGS;
    return {
      forbiddenWords: settings.forbiddenWords ?? [],
      forbiddenWordsMode: settings.forbiddenWordsMode ?? 'warn',
      antiSpamEnabled: settings.antiSpamEnabled ?? false,
      antiSpamMessagesLimit: settings.antiSpamMessagesLimit ?? 5,
      antiSpamTimeWindow: settings.antiSpamTimeWindow ?? 10,
      antiSpamAction: settings.antiSpamAction ?? 'warn',
      linksAllowed: settings.linksAllowed ?? true,
      linksRequireApproval: settings.linksRequireApproval ?? false,
      captchaEnabled: settings.captchaEnabled ?? false,
      captchaTimeout: settings.captchaTimeout ?? 300,
      mediaRequireApproval: settings.mediaRequireApproval ?? false,
      autoDeleteSpam: settings.autoDeleteSpam ?? false,
      autoBanRepeatOffenders: settings.autoBanRepeatOffenders ?? false,
    };
  }

  async updateModerationSettings(
    chatId: string,
    updatedBy: string,
    settings: Partial<typeof DEFAULT_MODERATION_SETTINGS>,
  ) {
    const [chat] = await this.db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chat) throw new NotFoundError('Chat', chatId);
    await this.requirePermission(chatId, updatedBy, 'canEditInfo');
    const existing = await this.getModerationSettings(chatId);
    const newSettings = { ...existing, ...settings };
    await this.db
      .insert(chatModerationSettings)
      .values({ chatId, ...newSettings })
      .onConflictDoUpdate({
        target: chatModerationSettings.chatId,
        set: { ...newSettings, updatedAt: new Date() },
      });
    await this.logAuditAction(chatId, updatedBy, 'moderation_settings_updated', null, { settings: newSettings });
    return newSettings;
  }

  async createTopic(chatId: string, createdBy: string, title: string, icon?: string, color?: number) {
    const [chat] = await this.db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chat || (chat.type !== 'supergroup' && chat.type !== 'group')) {
      throw new BadRequestError('Topics can only be created in groups and supergroups');
    }
    await this.requirePermission(chatId, createdBy, 'canManageTopics');
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatTopics)
      .where(eq(chatTopics.chatId, chatId));
    if ((countResult?.count ?? 0) >= 100) throw new BadRequestError('Maximum number of topics reached');
    const [topic] = await this.db
      .insert(chatTopics)
      .values({ chatId, title, icon: icon || null, color: color || null, createdBy })
      .returning();
    await this.logAuditAction(chatId, createdBy, 'topic_created', null, { topicId: topic.id, title });
    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'topic.created', chatId, topic });
    return topic;
  }

  async updateTopic(chatId: string, topicId: string, updatedBy: string, data: { title?: string; icon?: string; color?: number }) {
    const [topic] = await this.db
      .select()
      .from(chatTopics)
      .where(and(eq(chatTopics.chatId, chatId), eq(chatTopics.id, topicId)))
      .limit(1);
    if (!topic) throw new NotFoundError('Topic', topicId);
    await this.requirePermission(chatId, updatedBy, 'canManageTopics');
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.color !== undefined) updateData.color = data.color;
    const [updated] = await this.db
      .update(chatTopics)
      .set(updateData)
      .where(and(eq(chatTopics.chatId, chatId), eq(chatTopics.id, topicId)))
      .returning();
    await this.logAuditAction(chatId, updatedBy, 'topic_updated', null, { topicId, updates: data });
    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'topic.updated', chatId, topic: updated });
    return updated;
  }

  async deleteTopic(chatId: string, topicId: string, deletedBy: string) {
    const [topic] = await this.db
      .select()
      .from(chatTopics)
      .where(and(eq(chatTopics.chatId, chatId), eq(chatTopics.id, topicId)))
      .limit(1);
    if (!topic) throw new NotFoundError('Topic', topicId);
    await this.requirePermission(chatId, deletedBy, 'canManageTopics');
    await this.db.delete(chatTopics).where(and(eq(chatTopics.chatId, chatId), eq(chatTopics.id, topicId)));
    await this.logAuditAction(chatId, deletedBy, 'topic_deleted', null, { topicId });
    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'topic.deleted', chatId, topicId });
  }

  async getTopics(chatId: string, limit: number, offset: number) {
    const pageSize = clampPageSize(limit || DEFAULT_PAGE_SIZE);
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatTopics)
      .where(eq(chatTopics.chatId, chatId));
    const totalCount = countResult?.count ?? 0;
    const topics = await this.db
      .select({
        id: chatTopics.id,
        chatId: chatTopics.chatId,
        title: chatTopics.title,
        icon: chatTopics.icon,
        color: chatTopics.color,
        createdBy: chatTopics.createdBy,
        isClosed: chatTopics.isClosed,
        isPinned: chatTopics.isPinned,
        createdAt: chatTopics.createdAt,
        updatedAt: chatTopics.updatedAt,
        createdByName: users.displayName,
      })
      .from(chatTopics)
      .innerJoin(users, eq(chatTopics.createdBy, users.id))
      .where(eq(chatTopics.chatId, chatId))
      .orderBy(desc(chatTopics.isPinned), desc(chatTopics.updatedAt))
      .limit(pageSize)
      .offset(offset ?? 0);
    return { topics, totalCount };
  }

  async toggleTopic(chatId: string, topicId: string, toggledBy: string, isClosed: boolean) {
    const [topic] = await this.db
      .select()
      .from(chatTopics)
      .where(and(eq(chatTopics.chatId, chatId), eq(chatTopics.id, topicId)))
      .limit(1);
    if (!topic) throw new NotFoundError('Topic', topicId);
    await this.requirePermission(chatId, toggledBy, 'canManageTopics');
    await this.db
      .update(chatTopics)
      .set({ isClosed, updatedAt: new Date() })
      .where(and(eq(chatTopics.chatId, chatId), eq(chatTopics.id, topicId)));
    await this.logAuditAction(chatId, toggledBy, isClosed ? 'topic_closed' : 'topic_opened', null, { topicId });
    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: isClosed ? 'topic.closed' : 'topic.opened', chatId, topicId });
  }
}
