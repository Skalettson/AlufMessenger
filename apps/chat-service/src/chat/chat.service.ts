import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, sql, inArray, ne, desc, isNotNull } from 'drizzle-orm';
import {
  chats,
  chatMembers,
  messages,
  inviteLinks,
  users,
  contacts,
  reactions,
  messageStatus,
  calls,
  callParticipants,
  channelMessageStats,
  channelDailyStats,
  channelSubscribers,
} from '@aluf/db';
import type { MemberPermissions } from '@aluf/shared';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  NATS_SUBJECTS,
  DEFAULT_CHAT_SETTINGS,
  DEFAULT_MEMBER_PERMISSIONS,
  MAX_GROUP_MEMBERS,
  MAX_GROUP_MEMBERS_FREE,
  MAX_CHANNEL_SUBSCRIBERS,
  MESSAGE_RETENTION_DAYS_FREE,
  CHAT_USERNAME_MIN_LENGTH,
  CHAT_USERNAME_MAX_LENGTH,
  CHAT_USERNAME_REGEX,
  CHAT_TITLE_MAX_LENGTH,
  CHAT_DESCRIPTION_MAX_LENGTH,
  encodeCursor,
  decodeCursor,
  clampPageSize,
  DEFAULT_PAGE_SIZE,
  DEFAULT_MODERATION_SETTINGS,
} from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';
import { NATS_TOKEN, type NatsConnection } from '../providers/nats.provider';
import { StringCodec } from 'nats';
import { GroupChannelService } from './group-channel/group-channel.service';
import { MemberManagementService } from './group-channel/member-management.service';
import { GroupChannelAdminService } from './group-channel/group-channel-admin.service';

/** Имя из контакта (customName), иначе глобальное displayName пользователя. */
function pickContactDisplayName(
  customName: string | null | undefined,
  fallback: string | null | undefined,
): string {
  const c = customName?.trim();
  if (c) return c;
  return (fallback ?? '').trim();
}

const ALL_PERMISSIONS: MemberPermissions = {
  canDeleteMessages: true,
  canBanMembers: true,
  canPinMessages: true,
  canEditInfo: true,
  canInviteMembers: true,
  canManageVoiceChats: true,
  canPostMessages: true,
  canEditMessages: true,
  canRestrictMembers: true,
  canPostMedia: true,
  canSendPolls: true,
  canSendStickers: true,
  canManageTopics: true,
  canViewAuditLog: true,
  canDeleteMessagesOfOthers: true,
};

/** Приоритет storageKey (новые аватары), иначе legacy avatar_url. Ключ датой без ведущего / приводим к пути как в сторис. */
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
export class ChatService {
  private readonly sc = StringCodec();

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    @Inject(NATS_TOKEN) private readonly nats: NatsConnection,
    private readonly groupChannelService: GroupChannelService,
    private readonly memberManagementService: MemberManagementService,
    private readonly groupChannelAdminService: GroupChannelAdminService,
  ) {}

  private publish(subject: string, data: unknown): void {
    this.nats.publish(subject, this.sc.encode(JSON.stringify(data)));
  }

  private async getIsPremium(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ isPremium: users.isPremium })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.isPremium ?? false;
  }

  async createChat(
    type: string,
    creatorId: string,
    title: string,
    description: string,
    avatarUrl: string,
    memberIds: string[],
    channelUsername?: string,
  ) {
    switch (type) {
      case 'private': {
        if (memberIds.length !== 1) {
          throw new BadRequestError('Private chat requires exactly one other member');
        }
        return this.createPrivateChat(creatorId, memberIds[0]);
      }
      case 'group':
      case 'secret':
        return this.createGroupChat(creatorId, title, type as 'group' | 'secret', memberIds, description, avatarUrl, channelUsername);
      case 'channel':
        return this.createChannel(creatorId, title, description, avatarUrl, channelUsername);
      case 'saved':
        return this.getOrCreateSavedChat(creatorId);
      default:
        throw new BadRequestError('Invalid chat type');
    }
  }

  /** Чат «Избранное» (Saved Messages): один участник — сам пользователь. */
  async getOrCreateSavedChat(userId: string) {
    const memberRows = await this.db
      .select({ chatId: chatMembers.chatId })
      .from(chatMembers)
      .where(eq(chatMembers.userId, userId));
    const chatIds = memberRows.map((r) => r.chatId);
    if (chatIds.length > 0) {
      const [savedChat] = await this.db
        .select()
        .from(chats)
        .where(and(eq(chats.type, 'saved'), inArray(chats.id, chatIds)))
        .limit(1);
      if (savedChat) return savedChat;
    }

    const [chat] = await this.db
      .insert(chats)
      .values({
        type: 'saved',
        title: 'Избранное',
        createdBy: userId,
        memberCount: 1,
        settings: DEFAULT_CHAT_SETTINGS,
      })
      .returning();

    await this.db.insert(chatMembers).values({
      chatId: chat.id,
      userId,
      role: 'owner',
      permissions: ALL_PERMISSIONS,
    });

    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'chat.created', chat });
    return chat;
  }

  private async createPrivateChat(userId1: string, userId2: string) {
    const [existing] = await this.db
      .select({
        id: chats.id,
        type: chats.type,
        title: chats.title,
        description: chats.description,
        avatarUrl: chats.avatarUrl,
        createdBy: chats.createdBy,
        settings: chats.settings,
        memberCount: chats.memberCount,
        inviteLink: chats.inviteLink,
        lastMessageId: chats.lastMessageId,
        lastMessageAt: chats.lastMessageAt,
        createdAt: chats.createdAt,
        updatedAt: chats.updatedAt,
      })
      .from(chats)
      .where(
        and(
          eq(chats.type, 'private'),
          sql`EXISTS (SELECT 1 FROM chat_members WHERE chat_id = ${chats.id} AND user_id = ${userId1})`,
          sql`EXISTS (SELECT 1 FROM chat_members WHERE chat_id = ${chats.id} AND user_id = ${userId2})`,
        ),
      )
      .limit(1);

    if (existing) return existing;

    return this.db.transaction(async (tx) => {
      const [chat] = await tx
        .insert(chats)
        .values({
          type: 'private',
          createdBy: userId1,
          memberCount: 2,
          settings: DEFAULT_CHAT_SETTINGS,
        })
        .returning();

      await tx.insert(chatMembers).values([
        { chatId: chat.id, userId: userId1, role: 'member' as const, permissions: DEFAULT_MEMBER_PERMISSIONS },
        { chatId: chat.id, userId: userId2, role: 'member' as const, permissions: DEFAULT_MEMBER_PERMISSIONS },
      ]);

      this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'chat.created', chat });
      return chat;
    });
  }

  private async createGroupChat(
    creatorId: string,
    title: string,
    type: 'group' | 'secret',
    memberIds: string[],
    description: string,
    avatarUrl: string,
    username?: string,
  ) {
    if (title.length > CHAT_TITLE_MAX_LENGTH) {
      throw new BadRequestError(`Group name must be at most ${CHAT_TITLE_MAX_LENGTH} characters`);
    }
    const allMemberIds = [...new Set([creatorId, ...memberIds])];
    const isPremium = await this.getIsPremium(creatorId);
    const memberLimit = isPremium ? MAX_GROUP_MEMBERS : MAX_GROUP_MEMBERS_FREE;

    if (allMemberIds.length > memberLimit) {
      throw new BadRequestError(`Group cannot have more than ${memberLimit} members`);
    }

    const retentionDays = isPremium ? null : MESSAGE_RETENTION_DAYS_FREE;
    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase().replace(/^@/, '') : null;
    if (normalizedUsername !== null && normalizedUsername.length > 0) {
      if (normalizedUsername.length < CHAT_USERNAME_MIN_LENGTH || normalizedUsername.length > CHAT_USERNAME_MAX_LENGTH || !CHAT_USERNAME_REGEX.test(normalizedUsername)) {
        throw new BadRequestError(`Username: only a-z, 0-9 and _, ${CHAT_USERNAME_MIN_LENGTH}–${CHAT_USERNAME_MAX_LENGTH} characters (like Telegram)`);
      }
      const [existing] = await this.db.select({ id: chats.id }).from(chats).where(eq(chats.username, normalizedUsername)).limit(1);
      if (existing) throw new ConflictError('This username is already taken');
    }

    const settings = { ...DEFAULT_CHAT_SETTINGS, joinApprovalRequired: !normalizedUsername };

    return this.db.transaction(async (tx) => {
      const [chat] = await tx
        .insert(chats)
        .values({
          type,
          title: title || null,
          description: (description && description.length <= CHAT_DESCRIPTION_MAX_LENGTH ? description : description?.slice(0, CHAT_DESCRIPTION_MAX_LENGTH)) || null,
          avatarUrl: avatarUrl || null,
          createdBy: creatorId,
          memberCount: allMemberIds.length,
          username: normalizedUsername || null,
          settings,
          retentionDays,
        })
        .returning();

      const memberRows = allMemberIds.map((userId) => ({
        chatId: chat.id,
        userId,
        role: (userId === creatorId ? 'owner' : 'member') as 'owner' | 'member',
        permissions: userId === creatorId ? ALL_PERMISSIONS : DEFAULT_MEMBER_PERMISSIONS,
      }));

      await tx.insert(chatMembers).values(memberRows);

      this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'chat.created', chat });
      return chat;
    });
  }

  private async createChannel(
    creatorId: string,
    title: string,
    description: string,
    avatarUrl: string,
    username?: string,
  ) {
    if (title.length > CHAT_TITLE_MAX_LENGTH) {
      throw new BadRequestError(`Channel name must be at most ${CHAT_TITLE_MAX_LENGTH} characters`);
    }
    const isPremium = await this.getIsPremium(creatorId);
    const retentionDays = isPremium ? null : MESSAGE_RETENTION_DAYS_FREE;
    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase().replace(/^@/, '') : null;
    if (normalizedUsername !== null && normalizedUsername.length > 0) {
      if (normalizedUsername.length < CHAT_USERNAME_MIN_LENGTH || normalizedUsername.length > CHAT_USERNAME_MAX_LENGTH || !CHAT_USERNAME_REGEX.test(normalizedUsername)) {
        throw new BadRequestError(`Username: only a-z, 0-9 and _, ${CHAT_USERNAME_MIN_LENGTH}–${CHAT_USERNAME_MAX_LENGTH} characters (like Telegram)`);
      }
      const [existing] = await this.db.select({ id: chats.id }).from(chats).where(eq(chats.username, normalizedUsername)).limit(1);
      if (existing) throw new ConflictError('This username is already taken');
    }

    const settings = {
      ...DEFAULT_CHAT_SETTINGS,
      membersCanSendMessages: false,
      joinApprovalRequired: !normalizedUsername,
    };

    return this.db.transaction(async (tx) => {
      const [chat] = await tx
        .insert(chats)
        .values({
          type: 'channel',
          title: title || null,
          description: (description && description.length <= CHAT_DESCRIPTION_MAX_LENGTH ? description : description?.slice(0, CHAT_DESCRIPTION_MAX_LENGTH)) || null,
          avatarUrl: avatarUrl || null,
          createdBy: creatorId,
          memberCount: 1,
          username: normalizedUsername || null,
          settings,
          retentionDays,
        })
        .returning();

      await tx.insert(chatMembers).values({
        chatId: chat.id,
        userId: creatorId,
        role: 'owner',
        permissions: ALL_PERMISSIONS,
      });

      this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'chat.created', chat });
      return chat;
    });
  }

  async getChat(chatId: string) {
    const [chat] = await this.db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chat) throw new NotFoundError('Chat', chatId);
    return chat;
  }

  async getChatWithLastMessage(chatId: string, currentUserId?: string) {
    const [row] = await this.db
      .select({
        chat: chats,
        lastMsgId: messages.id,
        lastMsgSenderId: messages.senderId,
        lastMsgText: messages.textContent,
        lastMsgType: messages.contentType,
        lastMsgCreatedAt: messages.createdAt,
      })
      .from(chats)
      .leftJoin(messages, eq(chats.lastMessageId, messages.id))
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!row) throw new NotFoundError('Chat', chatId);

    let myMember: { role: string; canPostMessages: boolean } | undefined;
    if (currentUserId) {
      const [member] = await this.db
        .select({ role: chatMembers.role, permissions: chatMembers.permissions })
        .from(chatMembers)
        .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, currentUserId)))
        .limit(1);
      if (member) {
        const perms = (member.permissions ?? {}) as Record<string, boolean>;
        const canPost =
          row.chat.type === 'channel'
            ? member.role === 'owner' || member.role === 'admin' || perms.canPostMessages === true
            : true;
        myMember = { role: member.role, canPostMessages: canPost };
      }
    }

    let otherMember: { userId: string; displayName: string; avatarUrl: string | null; isBot: boolean; isPremium: boolean } | undefined;
    if (row.chat.type === 'private' && currentUserId) {
      const [other] = await this.db
        .select({
          userId: chatMembers.userId,
          displayName: users.displayName,
          avatarStorageKey: users.avatarStorageKey,
          avatarUrl: users.avatarUrl,
          isBot: users.isBot,
          isPremium: users.isPremium,
        })
        .from(chatMembers)
        .innerJoin(users, eq(chatMembers.userId, users.id))
        .where(and(eq(chatMembers.chatId, chatId), ne(chatMembers.userId, currentUserId)))
        .limit(1);
      if (other) {
        const [contactRow] = await this.db
          .select({ customName: contacts.customName })
          .from(contacts)
          .where(and(eq(contacts.userId, currentUserId), eq(contacts.contactUserId, other.userId)))
          .limit(1);
        otherMember = {
          userId: other.userId,
          displayName: pickContactDisplayName(contactRow?.customName, other.displayName),
          avatarUrl: pickUserAvatarUrl(other.avatarStorageKey, other.avatarUrl),
          isBot: other.isBot ?? false,
          isPremium: other.isPremium ?? false,
        };
      }
    }

    let senderDisplayName: string | null = null;
    if (row.lastMsgId && row.lastMsgSenderId) {
      if (currentUserId && row.lastMsgSenderId === currentUserId) {
        senderDisplayName = 'Вы';
      } else if (
        row.chat.type === 'private' &&
        otherMember &&
        row.lastMsgSenderId === otherMember.userId
      ) {
        senderDisplayName = otherMember.displayName;
      } else {
        const [u] = await this.db
          .select({ displayName: users.displayName })
          .from(users)
          .where(eq(users.id, row.lastMsgSenderId))
          .limit(1);
        senderDisplayName = u?.displayName ?? null;
      }
    }

    return {
      chat: row.chat,
      lastMessage: row.lastMsgId
        ? {
            id: row.lastMsgId,
            senderId: row.lastMsgSenderId!,
            textContent: row.lastMsgText,
            contentType: row.lastMsgType!,
            createdAt: row.lastMsgCreatedAt!,
            senderDisplayName,
          }
        : null,
      myMember,
      otherMember,
    };
  }

  /** Список чатов для админки (пагинация, опциональный фильтр по типу). */
  async listChats(
    limit: number,
    offset: number,
    typeFilter?: number,
  ): Promise<{ chats: typeof chats.$inferSelect[]; totalCount: number }> {
    const lim = Math.min(Math.max(1, limit || 20), 100);
    const off = Math.max(0, offset || 0);
    const protoToDb: Record<number, string> = {
      1: 'private',
      2: 'group',
      3: 'channel',
      4: 'secret',
      5: 'saved',
    };
    const dbType = typeFilter !== undefined && typeFilter !== 0 ? protoToDb[typeFilter] : undefined;
    const whereClause = dbType
      ? eq(chats.type, dbType as 'private' | 'group' | 'channel' | 'secret' | 'saved')
      : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chats)
      .where(whereClause ?? sql`true`);
    const totalCount = countResult?.count ?? 0;

    const rows = await this.db
      .select()
      .from(chats)
      .where(whereClause ?? sql`true`)
      .orderBy(desc(chats.createdAt))
      .limit(lim)
      .offset(off);

    return { chats: rows, totalCount };
  }

  async getUserChats(userId: string, cursor: string | undefined, limit: number) {
    const pageSize = clampPageSize(limit || DEFAULT_PAGE_SIZE);

    await this.getOrCreateSavedChat(userId);

    const conditions: ReturnType<typeof eq>[] = [
      eq(chatMembers.userId, userId),
      or(eq(chats.type, 'saved'), isNotNull(chats.lastMessageId))! as ReturnType<typeof eq>,
    ];

    if (cursor) {
      const decoded = decodeCursor<{ sortKey: string; id: string }>(cursor);
      const cursorTime = new Date(decoded.sortKey);
      conditions.push(
        or(
          sql`COALESCE(${chats.lastMessageAt}, ${chats.createdAt}) < ${cursorTime}`,
          and(
            sql`COALESCE(${chats.lastMessageAt}, ${chats.createdAt}) = ${cursorTime}`,
            sql`${chats.id} > ${decoded.id}`,
          ),
        )! as ReturnType<typeof eq>,
      );
    }

    const rows = await this.db
      .select({
        chat: chats,
        isPinned: chatMembers.isPinned,
        isArchived: chatMembers.isArchived,
        mutedUntil: chatMembers.mutedUntil,
        memberRole: chatMembers.role,
        memberPermissions: chatMembers.permissions,
        lastMsgId: messages.id,
        lastMsgSenderId: messages.senderId,
        lastMsgText: messages.textContent,
        lastMsgType: messages.contentType,
        lastMsgCreatedAt: messages.createdAt,
      })
      .from(chatMembers)
      .innerJoin(chats, eq(chatMembers.chatId, chats.id))
      .leftJoin(messages, eq(chats.lastMessageId, messages.id))
      .where(and(...conditions))
      .orderBy(desc(chatMembers.isPinned), sql`COALESCE(${chats.lastMessageAt}, ${chats.createdAt}) DESC`, chats.id)
      .limit(pageSize + 1);

    const hasMore = rows.length > pageSize;
    const rawItems = rows.slice(0, pageSize);
    const savedItem = rawItems.find((row) => row.chat.type === 'saved');
    const items = savedItem
      ? [savedItem, ...rawItems.filter((row) => row.chat.id !== savedItem.chat.id)]
      : rawItems;

    let nextCursor = '';
    if (hasMore && rawItems.length > 0) {
      const lastItem = rawItems[rawItems.length - 1];
      const sortKey = lastItem.chat.lastMessageAt ?? lastItem.chat.createdAt;
      nextCursor = encodeCursor({ sortKey: sortKey.toISOString(), id: lastItem.chat.id });
    }

    const privateChatIds = items.filter((row) => row.chat.type === 'private').map((row) => row.chat.id);
    let chatIdToOther: Record<string, { userId: string; displayName: string; avatarUrl: string | null; isBot: boolean; isPremium: boolean }> = {};
    if (privateChatIds.length > 0) {
      const otherMemberRows = await this.db
        .select({ chatId: chatMembers.chatId, userId: chatMembers.userId })
        .from(chatMembers)
        .where(and(inArray(chatMembers.chatId, privateChatIds), ne(chatMembers.userId, userId)));
      const otherUserIds = [...new Set(otherMemberRows.map((r) => r.userId))];
      if (otherUserIds.length > 0) {
        const usersRows = await this.db
          .select({
            id: users.id,
            displayName: users.displayName,
            avatarStorageKey: users.avatarStorageKey,
            avatarUrl: users.avatarUrl,
            isBot: users.isBot,
            isPremium: users.isPremium,
          })
          .from(users)
          .where(inArray(users.id, otherUserIds));
        const userIdToUser = Object.fromEntries(usersRows.map((u) => [u.id, u]));
        const contactRows = await this.db
          .select({ contactUserId: contacts.contactUserId, customName: contacts.customName })
          .from(contacts)
          .where(and(eq(contacts.userId, userId), inArray(contacts.contactUserId, otherUserIds)));
        const contactCustomByUserId = Object.fromEntries(contactRows.map((r) => [r.contactUserId, r.customName]));
        for (const m of otherMemberRows) {
          const u = userIdToUser[m.userId];
          if (u)
            chatIdToOther[m.chatId] = {
              userId: m.userId,
              displayName: pickContactDisplayName(contactCustomByUserId[m.userId], u.displayName),
              avatarUrl: pickUserAvatarUrl(u.avatarStorageKey, u.avatarUrl),
              isBot: u.isBot ?? false,
              isPremium: u.isPremium ?? false,
            };
        }
      }
    }

    const senderIds = [...new Set(items.map((row) => row.lastMsgSenderId).filter(Boolean))] as string[];
    let senderIdToDisplayName: Record<string, string> = {};
    if (senderIds.length > 0) {
      const senders = await this.db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, senderIds));
      senderIdToDisplayName = Object.fromEntries(
        senders.map((u) => [u.id, u.displayName ?? '']),
      );
    }

    return {
      chats: items.map((row) => {
        const senderId = row.lastMsgSenderId ?? null;
        const other = row.chat.type === 'private' ? chatIdToOther[row.chat.id] : undefined;
        const senderDisplayName =
          senderId === userId
            ? 'Вы'
            : senderId &&
                row.chat.type === 'private' &&
                other &&
                senderId === other.userId
              ? other.displayName
              : senderId
                ? (senderIdToDisplayName[senderId] ?? null)
                : null;
        const perms = (row.memberPermissions ?? {}) as Record<string, boolean>;
        const canPostMessages =
          row.chat.type === 'channel'
            ? row.memberRole === 'owner' || row.memberRole === 'admin' || perms.canPostMessages === true
            : true;
        return {
          chat: row.chat,
          isPinned: row.isPinned ?? false,
          isArchived: row.isArchived ?? false,
          isMuted: row.mutedUntil != null && row.mutedUntil > new Date(),
          lastMessage: row.lastMsgId
            ? {
                id: row.lastMsgId,
                senderId: row.lastMsgSenderId!,
                textContent: row.lastMsgText,
                contentType: row.lastMsgType!,
                createdAt: row.lastMsgCreatedAt!,
                senderDisplayName,
              }
            : null,
          otherMember: row.chat.type === 'private' ? chatIdToOther[row.chat.id] : undefined,
          myRole: row.memberRole,
          canPostMessages,
        };
      }),
      nextCursor,
      hasMore,
    };
  }

  /** Возвращает канал или группу с указанным публичным username. */
  async getChatByUsername(username: string) {
    const normalized = username.trim().toLowerCase().replace(/^@/, '');
    if (!normalized) throw new BadRequestError('Username is required');
    const [chat] = await this.db
      .select()
      .from(chats)
      .where(and(eq(chats.username, normalized), or(eq(chats.type, 'channel'), eq(chats.type, 'group'))))
      .limit(1);
    if (!chat) throw new NotFoundError('Chat', username);
    return chat;
  }

  async updateChat(
    chatId: string,
    userId: string,
    data: {
      title?: string;
      description?: string;
      avatarUrl?: string;
      username?: string;
      isPublic?: boolean;
      slowModeSeconds?: number;
    },
  ) {
    const [chat] = await this.db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chat) throw new NotFoundError('Chat', chatId);

    await this.requirePermission(chatId, userId, 'canEditInfo');

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

    const settingsPatch: Record<string, unknown> = {};

    if (data.username !== undefined && (chat.type === 'channel' || chat.type === 'group')) {
      const normalized = typeof data.username === 'string' ? data.username.trim().toLowerCase().replace(/^@/, '') : '';
      if (normalized === '') {
        updateData.username = null;
        settingsPatch.joinApprovalRequired = true;
      } else {
        if (normalized.length < CHAT_USERNAME_MIN_LENGTH || normalized.length > CHAT_USERNAME_MAX_LENGTH || !CHAT_USERNAME_REGEX.test(normalized)) {
          throw new BadRequestError(`Username: only a-z, 0-9 and _, ${CHAT_USERNAME_MIN_LENGTH}–${CHAT_USERNAME_MAX_LENGTH} characters (like Telegram)`);
        }
        const [existing] = await this.db
          .select({ id: chats.id })
          .from(chats)
          .where(and(eq(chats.username, normalized), ne(chats.id, chatId)))
          .limit(1);
        if (existing) throw new ConflictError('This username is already taken');
        updateData.username = normalized;
        settingsPatch.joinApprovalRequired = false;
      }
    }

    if (data.isPublic !== undefined) settingsPatch.joinApprovalRequired = !data.isPublic;
    if (data.slowModeSeconds !== undefined) settingsPatch.slowModeInterval = data.slowModeSeconds;

    if (Object.keys(settingsPatch).length > 0) {
      updateData.settings = { ...(chat.settings as Record<string, unknown>), ...settingsPatch };
    }

    const [updated] = await this.db
      .update(chats)
      .set(updateData)
      .where(eq(chats.id, chatId))
      .returning();

    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'chat.updated', chat: updated });
    return updated;
  }

  async deleteChat(chatId: string, userId: string) {
    const [chat] = await this.db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chat) throw new NotFoundError('Chat', chatId);
    if (chat.type === 'saved') {
      throw new BadRequestError('Cannot delete Saved Messages');
    }

    const member = await this.getMember(chatId, userId);
    if (!member) {
      throw new ForbiddenError('You are not a member of this chat');
    }
    // Удалить чат «для всех» может любой участник, не только владелец.
    // Сначала удаляем связанные записи из-за foreign key на chats.

    await this.db.transaction(async (tx) => {
      const chatMsgs = await tx.select({ id: messages.id }).from(messages).where(eq(messages.chatId, chatId));
      const messageIds = chatMsgs.map((m) => m.id);
      await tx.delete(channelMessageStats).where(eq(channelMessageStats.chatId, chatId));
      if (messageIds.length > 0) {
        await tx.delete(reactions).where(inArray(reactions.messageId, messageIds));
        await tx.delete(messageStatus).where(inArray(messageStatus.messageId, messageIds));
      }
      await tx.delete(messages).where(eq(messages.chatId, chatId));

      const chatCalls = await tx.select({ id: calls.id }).from(calls).where(eq(calls.chatId, chatId));
      const callIds = chatCalls.map((c) => c.id);
      if (callIds.length > 0) {
        await tx.delete(callParticipants).where(inArray(callParticipants.callId, callIds));
      }
      await tx.delete(calls).where(eq(calls.chatId, chatId));

      await tx.delete(inviteLinks).where(eq(inviteLinks.chatId, chatId));
      await tx.delete(chatMembers).where(eq(chatMembers.chatId, chatId));
      await tx.delete(chats).where(eq(chats.id, chatId));
    });

    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'chat.deleted', chatId });
  }

  /** Удаление чата админом без проверки участия (только gateway AdminGuard). */
  async deleteChatAdmin(chatId: string) {
    const [chat] = await this.db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chat) throw new NotFoundError('Chat', chatId);
    if (chat.type === 'saved') {
      throw new BadRequestError('Cannot delete Saved Messages');
    }
    await this.db.transaction(async (tx) => {
      const chatMsgs = await tx.select({ id: messages.id }).from(messages).where(eq(messages.chatId, chatId));
      const messageIds = chatMsgs.map((m) => m.id);
      await tx.delete(channelMessageStats).where(eq(channelMessageStats.chatId, chatId));
      if (messageIds.length > 0) {
        await tx.delete(reactions).where(inArray(reactions.messageId, messageIds));
        await tx.delete(messageStatus).where(inArray(messageStatus.messageId, messageIds));
      }
      await tx.delete(messages).where(eq(messages.chatId, chatId));
      const chatCalls = await tx.select({ id: calls.id }).from(calls).where(eq(calls.chatId, chatId));
      const callIds = chatCalls.map((c) => c.id);
      if (callIds.length > 0) {
        await tx.delete(callParticipants).where(inArray(callParticipants.callId, callIds));
      }
      await tx.delete(calls).where(eq(calls.chatId, chatId));
      await tx.delete(inviteLinks).where(eq(inviteLinks.chatId, chatId));
      await tx.delete(chatMembers).where(eq(chatMembers.chatId, chatId));
      await tx.delete(chats).where(eq(chats.id, chatId));
    });
    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'chat.deleted', chatId });
  }

  async pinChat(chatId: string, userId: string) {
    const member = await this.getMember(chatId, userId);
    if (!member) throw new NotFoundError('Not a member of this chat');
    await this.db
      .update(chatMembers)
      .set({ isPinned: true })
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'chat.pinned', chatId, userId });
  }

  async unpinChat(chatId: string, userId: string) {
    const member = await this.getMember(chatId, userId);
    if (!member) throw new NotFoundError('Not a member of this chat');
    await this.db
      .update(chatMembers)
      .set({ isPinned: false })
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));
    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'chat.unpinned', chatId, userId });
  }

  async addMembers(chatId: string, addedBy: string, userIds: string[]) {
    await this.memberManagementService.addMembers(chatId, addedBy, userIds);
  }

  async removeMember(chatId: string, removedBy: string, userId: string) {
    await this.memberManagementService.removeMember(chatId, removedBy, userId);
  }

  async getMembers(chatId: string, limit: number, offset: number, viewerUserId?: string | null) {
    const pageSize = clampPageSize(limit || DEFAULT_PAGE_SIZE);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMembers)
      .where(eq(chatMembers.chatId, chatId));

    const totalCount = countResult?.count ?? 0;

    const rows = await this.db
      .select({
        chatId: chatMembers.chatId,
        userId: chatMembers.userId,
        role: chatMembers.role,
        joinedAt: chatMembers.joinedAt,
        displayName: users.displayName,
        avatarStorageKey: users.avatarStorageKey,
        avatarUrl: users.avatarUrl,
        isBot: users.isBot,
        isPremium: users.isPremium,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
      })
      .from(chatMembers)
      .innerJoin(users, eq(chatMembers.userId, users.id))
      .where(eq(chatMembers.chatId, chatId))
      .limit(pageSize)
      .offset(offset ?? 0);

    const memberIds = rows.map((m) => m.userId);
    let contactCustomByUserId: Record<string, string | null> = {};
    if (viewerUserId && memberIds.length > 0) {
      const contactRows = await this.db
        .select({ contactUserId: contacts.contactUserId, customName: contacts.customName })
        .from(contacts)
        .where(and(eq(contacts.userId, viewerUserId), inArray(contacts.contactUserId, memberIds)));
      contactCustomByUserId = Object.fromEntries(contactRows.map((r) => [r.contactUserId, r.customName]));
    }

    return {
      members: rows.map((m) => ({
        chatId: m.chatId,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        displayName: pickContactDisplayName(contactCustomByUserId[m.userId], m.displayName),
        avatarUrl: pickUserAvatarUrl(m.avatarStorageKey, m.avatarUrl),
        isBot: m.isBot,
        isPremium: m.isPremium,
        premiumBadgeEmoji: m.premiumBadgeEmoji ?? null,
      })),
      totalCount,
    };
  }

  async updateMemberRole(chatId: string, updatedBy: string, userId: string, role: string) {
    const normalizedRole = role === 'moderator' ? 'admin' : role;
    await this.memberManagementService.updateRole(
      chatId,
      updatedBy,
      userId,
      normalizedRole as 'member' | 'admin' | 'owner',
    );
  }

  async joinChat(chatId: string, userId: string, inviteCode: string | undefined) {
    const [chat] = await this.db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chat) throw new NotFoundError('Chat', chatId);

    const existingMember = await this.getMember(chatId, userId);
    if (existingMember) return chat;

    const settings = (chat.settings ?? {}) as Record<string, unknown>;

    if (inviteCode) {
      const [link] = await this.db
        .select()
        .from(inviteLinks)
        .where(and(eq(inviteLinks.code, inviteCode), eq(inviteLinks.chatId, chatId)))
        .limit(1);

      if (!link) throw new NotFoundError('Invalid invite link');

      if (link.expiresAt && link.expiresAt < new Date()) {
        throw new BadRequestError('Invite link has expired');
      }
      if (link.usageLimit && link.usageCount >= link.usageLimit) {
        throw new BadRequestError('Invite link usage limit reached');
      }

      await this.db
        .update(inviteLinks)
        .set({ usageCount: sql`${inviteLinks.usageCount} + 1` })
        .where(eq(inviteLinks.id, link.id));
    } else if (settings.joinApprovalRequired) {
      throw new ForbiddenError('This chat requires an invite link to join');
    }

    const isPremium = await this.getIsPremium(chat.createdBy);
    const memberLimit = chat.type === 'channel' ? MAX_CHANNEL_SUBSCRIBERS : (isPremium ? MAX_GROUP_MEMBERS : MAX_GROUP_MEMBERS_FREE);
    if (memberLimit !== Infinity && chat.memberCount >= memberLimit) {
      throw new BadRequestError('Chat member limit reached');
    }

    await this.db.transaction(async (tx) => {
      await tx.insert(chatMembers).values({
        chatId,
        userId,
        role: 'member',
        permissions: DEFAULT_MEMBER_PERMISSIONS,
      });

      await tx
        .update(chats)
        .set({
          memberCount: sql`${chats.memberCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(chats.id, chatId));
    });

    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'member.joined', chatId, userId });

    const [updated] = await this.db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    return updated ?? chat;
  }

  async leaveChat(chatId: string, userId: string) {
    const member = await this.getMember(chatId, userId);
    if (!member) throw new NotFoundError('Not a member of this chat');

    const [chat] = await this.db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    if (!chat) throw new NotFoundError('Chat', chatId);

    if (chat.type === 'private') {
      throw new BadRequestError('Cannot leave a private chat');
    }
    if (chat.type === 'saved') {
      throw new BadRequestError('Cannot leave Saved Messages');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(chatMembers)
        .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)));

      await tx
        .update(chats)
        .set({
          memberCount: sql`GREATEST(${chats.memberCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(chats.id, chatId));
    });

    this.publish(NATS_SUBJECTS.CHAT_UPDATED, { event: 'member.left', chatId, userId });
  }

  async createInviteLink(
    chatId: string,
    createdBy: string,
    maxUses: number | undefined,
    expiresAt: Date | undefined,
  ) {
    return this.groupChannelAdminService.createInviteLink(chatId, createdBy, maxUses, expiresAt);
  }

  async getChatByInviteLink(code: string) {
    return this.groupChannelAdminService.getChatByInviteLink(code);
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
    if (!perms[permission]) {
      throw new ForbiddenError('Insufficient permissions');
    }
  }

  /** Получить список подписчиков канала */
  async getChannelSubscribers(
    chatId: string,
    userId: string,
    cursor: string | undefined,
    limit: number,
  ) {
    const [chat] = await this.db
      .select({ type: chats.type })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat) throw new NotFoundError('Chat', chatId);
    if (chat.type !== 'channel') {
      throw new BadRequestError('This chat is not a channel');
    }

    await this.requirePermission(chatId, userId, 'canEditInfo');

    const pageSize = clampPageSize(limit || DEFAULT_PAGE_SIZE);

    const conditions: ReturnType<typeof eq>[] = [
      eq(channelSubscribers.chatId, chatId),
      eq(channelSubscribers.isActive, true),
    ];

    if (cursor) {
      const decoded = decodeCursor<{ subscribedAt: string; userId: string }>(cursor);
      const cursorTime = new Date(decoded.subscribedAt);
      conditions.push(
        or(
          sql`${channelSubscribers.subscribedAt} < ${cursorTime}`,
          and(
            sql`${channelSubscribers.subscribedAt} = ${cursorTime}`,
            sql`${channelSubscribers.userId} > ${decoded.userId}`,
          ),
        )! as ReturnType<typeof eq>,
      );
    }

    const rows = await this.db
      .select({
        chatId: channelSubscribers.chatId,
        userId: channelSubscribers.userId,
        subscribedAt: channelSubscribers.subscribedAt,
        notificationsEnabled: channelSubscribers.notificationsEnabled,
        lastActivityAt: channelSubscribers.lastActivityAt,
        displayName: users.displayName,
        avatarStorageKey: users.avatarStorageKey,
        avatarUrl: users.avatarUrl,
        username: users.username,
        isBot: users.isBot,
        isPremium: users.isPremium,
      })
      .from(channelSubscribers)
      .innerJoin(users, eq(channelSubscribers.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(channelSubscribers.subscribedAt), channelSubscribers.userId)
      .limit(pageSize + 1);

    const hasMore = rows.length > pageSize;
    const items = rows.slice(0, pageSize);

    let nextCursor = '';
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = encodeCursor({
        subscribedAt: lastItem.subscribedAt.toISOString(),
        userId: lastItem.userId,
      });
    }

    return {
      subscribers: items.map((item) => ({
        chatId: item.chatId,
        userId: item.userId,
        displayName: item.displayName ?? '',
        avatarUrl: pickUserAvatarUrl(item.avatarStorageKey, item.avatarUrl),
        username: item.username ?? null,
        isBot: item.isBot ?? false,
        isPremium: item.isPremium ?? false,
        subscribedAt: item.subscribedAt,
        notificationsEnabled: item.notificationsEnabled,
        lastActivityAt: item.lastActivityAt ?? null,
      })),
      nextCursor,
      hasMore,
    };
  }

  /** Получить статистику канала */
  async getChannelStats(chatId: string, periodDays: number = 7) {
    const [chat] = await this.db
      .select({ type: chats.type })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat) throw new NotFoundError('Chat', chatId);
    if (chat.type !== 'channel') {
      throw new BadRequestError('This chat is not a channel');
    }

    const now = new Date();
    const fromDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    // Получаем дневную статистику за период
    const dailyStatsRows = await this.db
      .select()
      .from(channelDailyStats)
      .where(
        and(
          eq(channelDailyStats.chatId, chatId),
          sql`${channelDailyStats.date} >= ${fromDate}`,
        ),
      )
      .orderBy(desc(channelDailyStats.date));

    // Текущее количество подписчиков
    const [subscriberCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(channelSubscribers)
      .where(
        and(
          eq(channelSubscribers.chatId, chatId),
          eq(channelSubscribers.isActive, true),
        ),
      );

    // Статистика по сообщениям
    const messageStatsRows = await this.db
      .select({
        views: channelMessageStats.views,
        forwards: channelMessageStats.forwards,
        reactions: channelMessageStats.reactions,
        uniqueViewers: channelMessageStats.uniqueViewers,
      })
      .from(channelMessageStats)
      .where(eq(channelMessageStats.chatId, chatId))
      .limit(100);

    // Агрегируем данные
    let totalViews = 0n;
    let totalForwards = 0n;
    let totalReactions = new Map<string, number>();
    let totalUniqueViewers = 0;
    let messagesWithStats = 0;

    for (const row of messageStatsRows) {
      totalViews += row.views;
      totalForwards += row.forwards;
      totalUniqueViewers += row.uniqueViewers;
      messagesWithStats++;

      const reactionsObj = row.reactions as Record<string, number> | null;
      if (reactionsObj) {
        for (const [emoji, cnt] of Object.entries(reactionsObj)) {
          totalReactions.set(emoji, (totalReactions.get(emoji) || 0) + cnt);
        }
      }
    }

    let totalNewSubscribers = 0;
    let totalUnsubscribers = 0;
    let totalReach = 0;

    for (const row of dailyStatsRows) {
      totalNewSubscribers += row.newSubscribers;
      totalUnsubscribers += row.unsubscribers;
      totalReach += row.reach;
    }

    const avgViewsPerPost = messagesWithStats > 0 ? Number(totalViews) / messagesWithStats : 0;
    const currentSubscribers = subscriberCount?.count ?? 0;
    const totalReactionsCount = Array.from(totalReactions.values()).reduce((a, b) => a + b, 0);
    const engagement = currentSubscribers > 0
      ? ((totalReactionsCount + Number(totalForwards)) / currentSubscribers) * 100
      : 0;

    return {
      chatId,
      totalSubscribers: currentSubscribers,
      subscriberGrowth: totalNewSubscribers - totalUnsubscribers,
      totalViews,
      avgViewsPerPost,
      totalReactions: BigInt(Object.values(totalReactions).reduce((a, b) => a + b, 0)),
      totalForwards,
      reach: totalReach,
      engagement,
      period: {
        from: fromDate,
        to: now,
      },
      dailyStats: dailyStatsRows.map((row) => ({
        id: row.id,
        chatId: row.chatId,
        date: row.date,
        totalSubscribers: row.totalSubscribers,
        newSubscribers: row.newSubscribers,
        unsubscribers: row.unsubscribers,
        totalViews: row.totalViews,
        totalReactions: row.totalReactions,
        totalForwards: row.totalForwards,
        messagesSent: row.messagesSent,
        reach: row.reach,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    };
  }

  /** Привязать группу для обсуждений к каналу */
  async linkDiscussionGroup(channelId: string, groupId: string, userId: string) {
    return this.groupChannelAdminService.linkDiscussionGroup(channelId, groupId, userId);
  }

  /** Отвязать группу обсуждений от канала */
  async unlinkDiscussionGroup(channelId: string, userId: string) {
    return this.groupChannelAdminService.unlinkDiscussionGroup(channelId, userId);
  }

  /** Обновить статистику сообщения (вызывается при просмотре) */
  async incrementMessageViews(messageId: bigint, chatId: string, _viewerId: string) {
    const [existing] = await this.db
      .select()
      .from(channelMessageStats)
      .where(
        and(
          eq(channelMessageStats.messageId, messageId),
          eq(channelMessageStats.chatId, chatId),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(channelMessageStats)
        .set({
          views: sql`${channelMessageStats.views} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(channelMessageStats.messageId, messageId),
            eq(channelMessageStats.chatId, chatId),
          ),
        );
    } else {
      await this.db
        .insert(channelMessageStats)
        .values({
          chatId,
          messageId,
          views: 1n,
          forwards: 0n,
          reactions: {},
          uniqueViewers: 1,
        });
    }
  }

  // === Методы для банов участников ===

  async banMember(
    chatId: string,
    bannedBy: string,
    userId: string,
    reason: string,
    expiresAt: Date | null,
    deleteMessages: boolean,
  ) {
    await this.groupChannelAdminService.banMember(chatId, bannedBy, userId, reason, expiresAt, deleteMessages);
  }

  async unbanMember(chatId: string, unbannedBy: string, userId: string) {
    await this.groupChannelAdminService.unbanMember(chatId, unbannedBy, userId);
  }

  async getBannedMembers(chatId: string, limit: number, offset: number) {
    return this.groupChannelAdminService.getBannedMembers(chatId, limit, offset);
  }

  // === Audit Log ===

  async getAuditLog(chatId: string, limit: number, offset: number, actionFilter?: string) {
    return this.groupChannelAdminService.getAuditLog(chatId, limit, offset, actionFilter);
  }

  // === Настройки модерации ===

  async getModerationSettings(chatId: string) {
    return this.groupChannelAdminService.getModerationSettings(chatId);
  }

  async updateModerationSettings(
    chatId: string,
    updatedBy: string,
    settings: Partial<typeof DEFAULT_MODERATION_SETTINGS>,
  ) {
    return this.groupChannelAdminService.updateModerationSettings(chatId, updatedBy, settings);
  }

  // === Темы/топики ===

  async createTopic(chatId: string, createdBy: string, title: string, icon?: string, color?: number) {
    return this.groupChannelAdminService.createTopic(chatId, createdBy, title, icon, color);
  }

  async updateTopic(chatId: string, topicId: string, updatedBy: string, data: { title?: string; icon?: string; color?: number }) {
    return this.groupChannelAdminService.updateTopic(chatId, topicId, updatedBy, data);
  }

  async deleteTopic(chatId: string, topicId: string, deletedBy: string) {
    await this.groupChannelAdminService.deleteTopic(chatId, topicId, deletedBy);
  }

  async getTopics(chatId: string, limit: number, offset: number) {
    return this.groupChannelAdminService.getTopics(chatId, limit, offset);
  }

  async toggleTopic(chatId: string, topicId: string, toggledBy: string, isClosed: boolean) {
    return this.groupChannelAdminService.toggleTopic(chatId, topicId, toggledBy, isClosed);
  }

  async muteChat(chatId: string, userId: string, mutedUntil: Date) {
    await this.groupChannelService.mute(chatId, userId, mutedUntil);
  }

  async unmuteChat(chatId: string, userId: string) {
    await this.groupChannelService.unmute(chatId, userId);
  }

  async archiveChat(chatId: string, userId: string) {
    await this.groupChannelService.archive(chatId, userId);
  }

  async unarchiveChat(chatId: string, userId: string) {
    await this.groupChannelService.unarchive(chatId, userId);
  }
}
