import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, and, or, desc, asc, sql, lt, gt, inArray } from 'drizzle-orm';
import { messages, chatMembers, chats, users, reactions, messageStatus, mediaFiles, stickerPacks, channelMessageStats } from '@aluf/db';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  NATS_SUBJECTS,
  generateSnowflakeId,
  initSnowflake,
  snowflakeToString,
  stringToSnowflake,
  encodeCursor,
  decodeCursor,
  clampPageSize,
  DEFAULT_PAGE_SIZE,
  MAX_PINNED_MESSAGES,
  MAX_PINNED_MESSAGES_PREMIUM,
  MAX_REACTIONS_PER_MESSAGE,
  MAX_REACTIONS_PER_MESSAGE_PREMIUM,
  SELF_DESTRUCT_MAX_SEC_FREE,
  SELF_DESTRUCT_MAX_SEC_PREMIUM,
} from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';
import { NATS_TOKEN, type NatsConnection } from '../providers/nats.provider';
import { StringCodec } from 'nats';

const DELETE_FOR_ALL_WINDOW_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class MessageService {
  private readonly sc = StringCodec();

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    @Inject(NATS_TOKEN) private readonly nats: NatsConnection,
  ) {
    initSnowflake(Number(process.env.NODE_ID) || 1);
  }

  private publish(subject: string, data: unknown): void {
    this.nats.publish(subject, this.sc.encode(JSON.stringify(data)));
  }

  /** Агрегированные реакции для одного сообщения (для WS). */
  private async getAggregatedReactionsForMessage(messageId: bigint): Promise<{ emoji: string; count: number }[]> {
    const rows = await this.db
      .select({
        emoji: reactions.emoji,
        count: sql<number>`count(*)::int`,
      })
      .from(reactions)
      .where(eq(reactions.messageId, messageId))
      .groupBy(reactions.emoji);
    return rows.map((r) => ({ emoji: r.emoji, count: r.count }));
  }

  private async publishMessageReactions(chatId: string, messageId: string): Promise<void> {
    const msgId = BigInt(messageId);
    const aggregated = await this.getAggregatedReactionsForMessage(msgId);
    this.publish(NATS_SUBJECTS.MESSAGE_REACTION, {
      chatId,
      messageId,
      reactions: aggregated,
    });
  }

  private async getIsPremium(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ isPremium: users.isPremium })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.isPremium ?? false;
  }

  async sendMessage(
    chatId: string,
    senderId: string,
    data: {
      contentType: string;
      textContent: string;
      mediaId: string;
      replyToId: string;
      metadata: Record<string, unknown>;
      selfDestructSeconds: number;
      hideAuthor?: boolean;
    },
  ) {
    await this.requireChatMembership(chatId, senderId);

    const [chat] = await this.db
      .select({ type: chats.type, settings: chats.settings })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);
    if (!chat) throw new NotFoundError('Chat', chatId);

    // Проверка hideAuthor: доступно только для каналов и только админам
    if (data.hideAuthor) {
      if (chat.type !== 'channel') {
        throw new BadRequestError('hideAuthor is only available for channels');
      }
      const [member] = await this.db
        .select({ role: chatMembers.role, permissions: chatMembers.permissions })
        .from(chatMembers)
        .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, senderId)))
        .limit(1);
      if (!member) throw new ForbiddenError('Not a member of this channel');
      const isAdmin = member.role === 'owner' || member.role === 'admin';
      const perms = (member.permissions ?? {}) as Record<string, boolean>;
      const canPost = perms.canPostMessages === true;
      if (!isAdmin && !canPost) {
        throw new ForbiddenError('Only admins can post in this channel');
      }
    }

    if (chat.type === 'channel') {
      const settings = (chat.settings ?? {}) as Record<string, unknown>;
      const membersCanSend = settings.membersCanSendMessages === true;
      if (!membersCanSend) {
        const [member] = await this.db
          .select({ role: chatMembers.role, permissions: chatMembers.permissions })
          .from(chatMembers)
          .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, senderId)))
          .limit(1);
        if (!member) throw new ForbiddenError('Not a member of this channel');
        const isAdmin = member.role === 'owner' || member.role === 'admin';
        const perms = (member.permissions ?? {}) as Record<string, boolean>;
        const canPost = perms.canPostMessages === true;
        if (!isAdmin && !canPost) {
          throw new ForbiddenError('Only admins can post in this channel');
        }
      }
    }

    if (data.selfDestructSeconds > 0) {
      const isPremium = await this.getIsPremium(senderId);
      const maxSec = isPremium ? SELF_DESTRUCT_MAX_SEC_PREMIUM : SELF_DESTRUCT_MAX_SEC_FREE;
      if (data.selfDestructSeconds > maxSec) {
        throw new BadRequestError(
          `Self-destruct timer cannot exceed ${maxSec === SELF_DESTRUCT_MAX_SEC_FREE ? '24 hours' : '7 days'} for your plan`,
        );
      }
    }

    if (data.contentType === 'sticker' && data.mediaId?.trim()) {
      const [media] = await this.db
        .select({ stickerPackId: mediaFiles.stickerPackId })
        .from(mediaFiles)
        .where(eq(mediaFiles.id, data.mediaId.trim()))
        .limit(1);
      if (media?.stickerPackId) {
        const [pack] = await this.db
          .select({ isPremium: stickerPacks.isPremium })
          .from(stickerPacks)
          .where(eq(stickerPacks.id, media.stickerPackId))
          .limit(1);
        if (pack?.isPremium) {
          const isPremium = await this.getIsPremium(senderId);
          if (!isPremium) {
            throw new ForbiddenError('This sticker pack is available only for Aluf Premium');
          }
        }
      }
    }

    const messageId = generateSnowflakeId();

    const selfDestructAt =
      data.selfDestructSeconds > 0
        ? new Date(Date.now() + data.selfDestructSeconds * 1000)
        : null;

    const [message] = await this.db
      .insert(messages)
      .values({
        id: messageId,
        chatId,
        senderId,
        contentType: data.contentType as typeof messages.contentType.enumValues[number],
        textContent: data.textContent || null,
        mediaId: data.mediaId || null,
        replyToId: data.replyToId ? stringToSnowflake(data.replyToId) : null,
        metadata: data.metadata ?? {},
        hideAuthor: data.hideAuthor ?? false,
        selfDestructAt,
      })
      .returning();

    await this.db
      .update(chats)
      .set({
        lastMessageId: messageId,
        lastMessageAt: message.createdAt,
        updatedAt: new Date(),
      })
      .where(eq(chats.id, chatId));

    if (chat.type === 'channel') {
      await this.db
        .insert(channelMessageStats)
        .values({
          chatId,
          messageId,
          views: 1n,
          forwards: 0n,
          reactions: {},
          uniqueViewers: 1,
        })
        .catch(() => {});
    }

    const memberRows = await this.db
      .select({ userId: chatMembers.userId })
      .from(chatMembers)
      .where(eq(chatMembers.chatId, chatId));
    const memberIds = memberRows.map((r) => r.userId);

    const [sender] = await this.db
      .select({
        displayName: users.displayName,
        username: users.username,
        avatarUrl: users.avatarUrl,
        isPremium: users.isPremium,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isVerified: users.isVerified,
        isOfficial: users.isOfficial,
      })
      .from(users)
      .where(eq(users.id, message.senderId))
      .limit(1);

    this.publish(NATS_SUBJECTS.MESSAGE_SENT, {
      id: snowflakeToString(message.id),
      chatId: message.chatId,
      senderId: message.senderId,
      senderDisplayName: sender?.displayName ?? null,
      senderUsername: sender?.username ?? null,
      senderIsPremium: sender?.isPremium ?? false,
      senderPremiumBadgeEmoji: sender?.premiumBadgeEmoji ?? null,
      senderIsVerified: sender?.isVerified ?? false,
      senderIsOfficial: sender?.isOfficial ?? false,
      contentType: message.contentType,
      textContent: message.textContent,
      mediaId: message.mediaId,
      replyToId: message.replyToId?.toString() ?? null,
      metadata: message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
        ? (message.metadata as Record<string, unknown>)
        : {},
      createdAt: message.createdAt.toISOString(),
      memberIds,
    });

    return {
      ...message,
      senderDisplayName: sender?.displayName ?? '',
      senderAvatarUrl: sender?.avatarUrl ?? null,
      senderIsPremium: sender?.isPremium ?? false,
      senderPremiumBadgeEmoji: sender?.premiumBadgeEmoji ?? null,
      senderIsVerified: sender?.isVerified ?? false,
      senderIsOfficial: sender?.isOfficial ?? false,
    };
  }

  async getMessages(
    chatId: string,
    cursor: string | undefined,
    limit: number,
    direction: number,
  ) {
    const pageSize = clampPageSize(limit || DEFAULT_PAGE_SIZE);
    const isForward = direction === 2;

    const [chatRow] = await this.db
      .select({ type: chats.type })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);
    const isChannelChat = chatRow?.type === 'channel';

    const conditions: (ReturnType<typeof eq>)[] = [eq(messages.chatId, chatId)];

    if (cursor) {
      const decoded = decodeCursor<{ t: string; id: string }>(cursor);
      const cursorTime = new Date(decoded.t);
      const cursorId = BigInt(decoded.id);

      if (isForward) {
        conditions.push(
          or(
            gt(messages.createdAt, cursorTime),
            and(eq(messages.createdAt, cursorTime), gt(messages.id, cursorId))!,
          )! as ReturnType<typeof eq>,
        );
      } else {
        conditions.push(
          or(
            lt(messages.createdAt, cursorTime),
            and(eq(messages.createdAt, cursorTime), lt(messages.id, cursorId))!,
          )! as ReturnType<typeof eq>,
        );
      }
    }

    const orderDir = isForward ? asc : desc;

    const rows = await this.db
      .select({
        id: messages.id,
        chatId: messages.chatId,
        senderId: messages.senderId,
        replyToId: messages.replyToId,
        forwardFromId: messages.forwardFromId,
        forwardFromChatId: messages.forwardFromChatId,
        contentType: messages.contentType,
        textContent: messages.textContent,
        mediaId: messages.mediaId,
        metadata: messages.metadata,
        isEdited: messages.isEdited,
        isPinned: messages.isPinned,
        selfDestructAt: messages.selfDestructAt,
        createdAt: messages.createdAt,
        editedAt: messages.editedAt,
        senderDisplayName: users.displayName,
        senderUsername: users.username,
        senderAvatarUrl: users.avatarUrl,
        senderIsPremium: users.isPremium,
        senderPremiumBadgeEmoji: users.premiumBadgeEmoji,
        senderIsVerified: users.isVerified,
        senderIsOfficial: users.isOfficial,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(and(...conditions))
      .orderBy(orderDir(messages.createdAt), orderDir(messages.id))
      .limit(pageSize + 1);

    const hasMore = rows.length > pageSize;
    const items = rows.slice(0, pageSize);

    let viewCountMap: Record<string, number> = {};
    if (isChannelChat && items.length > 0) {
      const msgIds = items.map((r) => r.id);
      const statsRows = await this.db
        .select({ messageId: channelMessageStats.messageId, views: channelMessageStats.views })
        .from(channelMessageStats)
        .where(inArray(channelMessageStats.messageId, msgIds));
      viewCountMap = Object.fromEntries(
        statsRows.map((s) => [s.messageId.toString(), Number(s.views)]),
      );
      this.db
        .update(channelMessageStats)
        .set({ views: sql`${channelMessageStats.views} + 1`, updatedAt: new Date() })
        .where(inArray(channelMessageStats.messageId, msgIds))
        .catch(() => {});
    }

    const forwardChatIds = [...new Set(items.map((r) => r.forwardFromChatId).filter(Boolean))] as string[];
    let forwardChatTitles: Record<string, string> = {};
    let forwardChatTypes: Record<string, string> = {};
    if (forwardChatIds.length > 0) {
      const chatRows = await this.db
        .select({ id: chats.id, title: chats.title, type: chats.type })
        .from(chats)
        .where(inArray(chats.id, forwardChatIds));
      forwardChatTitles = Object.fromEntries(
        chatRows.map((c) => [c.id, (c.title ?? (c.type === 'channel' ? 'Канал' : 'Чат')) ?? '']),
      );
      forwardChatTypes = Object.fromEntries(chatRows.map((c) => [c.id, c.type]));
    }

    const forwardOrigIds = items.map((r) => r.forwardFromId).filter(Boolean) as bigint[];
    let forwardSenderNames: Record<string, string> = {};
    if (forwardOrigIds.length > 0) {
      const origMsgRows = await this.db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          senderName: users.displayName,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(inArray(messages.id, forwardOrigIds));
      forwardSenderNames = Object.fromEntries(
        origMsgRows.map((r) => [r.id.toString(), r.senderName ?? '']),
      );
    }

    let reactionsMap: Record<string, { emoji: string; count: number }[]> = {};
    if (items.length > 0) {
      const msgIds = items.map((r) => r.id);
      const reactionRows = await this.db
        .select({
          messageId: reactions.messageId,
          emoji: reactions.emoji,
          count: sql<number>`count(*)::int`,
        })
        .from(reactions)
        .where(inArray(reactions.messageId, msgIds))
        .groupBy(reactions.messageId, reactions.emoji);

      for (const row of reactionRows) {
        const key = row.messageId.toString();
        if (!reactionsMap[key]) reactionsMap[key] = [];
        reactionsMap[key].push({ emoji: row.emoji, count: row.count });
      }
    }

    const messagesWithForward = items.map((r) => {
      const fwdChatType = r.forwardFromChatId ? forwardChatTypes[r.forwardFromChatId] : undefined;
      const fwdSenderName = r.forwardFromId ? (forwardSenderNames[r.forwardFromId.toString()] ?? '') : '';
      const fwdChatTitle = r.forwardFromChatId
        ? (fwdChatType === 'private' ? '' : (forwardChatTitles[r.forwardFromChatId] ?? ''))
        : undefined;
      return {
        ...r,
        forwardFromChatTitle: fwdChatTitle,
        forwardFromSenderName: fwdSenderName,
        ...(isChannelChat ? { viewCount: viewCountMap[r.id.toString()] ?? 0 } : {}),
        reactions: reactionsMap[r.id.toString()] ?? [],
      };
    });

    let nextCursor = '';
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor({
        t: last.createdAt.toISOString(),
        id: last.id.toString(),
      });
    }

    return { messages: messagesWithForward, nextCursor, hasMore };
  }

  async getMessage(messageId: string, chatId: string) {
    const msgId = BigInt(messageId);
    const [row] = await this.db
      .select({
        id: messages.id,
        chatId: messages.chatId,
        senderId: messages.senderId,
        replyToId: messages.replyToId,
        forwardFromId: messages.forwardFromId,
        forwardFromChatId: messages.forwardFromChatId,
        contentType: messages.contentType,
        textContent: messages.textContent,
        mediaId: messages.mediaId,
        metadata: messages.metadata,
        isEdited: messages.isEdited,
        isPinned: messages.isPinned,
        selfDestructAt: messages.selfDestructAt,
        createdAt: messages.createdAt,
        editedAt: messages.editedAt,
        senderDisplayName: users.displayName,
        senderAvatarUrl: users.avatarUrl,
        senderIsPremium: users.isPremium,
        senderPremiumBadgeEmoji: users.premiumBadgeEmoji,
        senderIsVerified: users.isVerified,
        senderIsOfficial: users.isOfficial,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(and(eq(messages.id, msgId), eq(messages.chatId, chatId)))
      .limit(1);

    if (!row) throw new NotFoundError('Message', messageId);

    const reactionsAgg = await this.getAggregatedReactionsForMessage(msgId);
    return { ...row, reactions: reactionsAgg };
  }

  async editMessage(messageId: string, chatId: string, editorId: string, newText: string) {
    const msgId = BigInt(messageId);
    const [message] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, msgId), eq(messages.chatId, chatId)))
      .limit(1);

    if (!message) throw new NotFoundError('Message', messageId);

    if (message.forwardFromId != null) {
      throw new BadRequestError('Forwarded messages cannot be edited');
    }

    const [chat] = await this.db.select({ type: chats.type }).from(chats).where(eq(chats.id, chatId)).limit(1);
    const isChannel = chat?.type === 'channel';
    const isSender = message.senderId === editorId;

    if (!isSender) {
      if (isChannel) {
        const [member] = await this.db
          .select({ role: chatMembers.role, permissions: chatMembers.permissions })
          .from(chatMembers)
          .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, editorId)))
          .limit(1);
        const canEdit = member && (member.role === 'owner' || member.role === 'admin');
        const perms = (member?.permissions ?? {}) as Record<string, boolean>;
        if (!canEdit || !perms.canEditMessages) {
          throw new ForbiddenError('Only the sender or channel admins with edit permission can edit this message');
        }
      } else {
        throw new ForbiddenError('Only the sender can edit this message');
      }
    }

    const [updated] = await this.db
      .update(messages)
      .set({
        textContent: newText,
        isEdited: true,
        editedAt: new Date(),
      })
      .where(eq(messages.id, msgId))
      .returning();

    this.publish(NATS_SUBJECTS.MESSAGE_EDITED, {
      id: snowflakeToString(updated.id),
      chatId: updated.chatId,
      editorId,
      textContent: updated.textContent,
      editedAt: updated.editedAt?.toISOString(),
    });

    const [sender] = await this.db
      .select({
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isPremium: users.isPremium,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isVerified: users.isVerified,
        isOfficial: users.isOfficial,
      })
      .from(users)
      .where(eq(users.id, updated.senderId))
      .limit(1);

    return {
      ...updated,
      senderDisplayName: sender?.displayName ?? '',
      senderAvatarUrl: sender?.avatarUrl ?? null,
      senderIsPremium: sender?.isPremium ?? false,
      senderPremiumBadgeEmoji: sender?.premiumBadgeEmoji ?? null,
      senderIsVerified: sender?.isVerified ?? false,
      senderIsOfficial: sender?.isOfficial ?? false,
    };
  }

  async deleteMessage(
    messageId: string,
    chatId: string,
    deleterId: string,
    deleteForEveryone: boolean,
  ) {
    const msgId = BigInt(messageId);
    const [message] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, msgId), eq(messages.chatId, chatId)))
      .limit(1);

    if (!message) throw new NotFoundError('Message', messageId);

    if (deleteForEveryone) {
      const isSender = message.senderId === deleterId;
      const isAdmin = await this.isAdminOrOwner(chatId, deleterId);

      if (!isSender && !isAdmin) {
        throw new ForbiddenError('Insufficient permissions to delete this message');
      }

      if (isSender && !isAdmin) {
        const ageMs = Date.now() - message.createdAt.getTime();
        if (ageMs > DELETE_FOR_ALL_WINDOW_MS) {
          throw new BadRequestError('Cannot delete message for everyone after 48 hours');
        }
      }

      await this.db.delete(channelMessageStats).where(eq(channelMessageStats.messageId, msgId)).catch(() => {});
      await this.db.delete(messages).where(eq(messages.id, msgId));

      this.publish(NATS_SUBJECTS.MESSAGE_DELETED, {
        id: messageId,
        chatId,
        deleterId,
        deleteForEveryone: true,
      });
    } else {
      await this.db
        .insert(messageStatus)
        .values({
          messageId: msgId,
          userId: deleterId,
          status: 'failed',
        })
        .onConflictDoUpdate({
          target: [messageStatus.messageId, messageStatus.userId],
          set: { status: 'failed' as const, timestamp: new Date() },
        });

      this.publish(NATS_SUBJECTS.MESSAGE_DELETED, {
        id: messageId,
        chatId,
        deleterId,
        deleteForEveryone: false,
      });
    }
  }

  async pinMessage(messageId: string, chatId: string, pinnedBy: string) {
    await this.requirePinPermission(chatId, pinnedBy);

    const msgId = BigInt(messageId);
    const [message] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, msgId), eq(messages.chatId, chatId)))
      .limit(1);

    if (!message) throw new NotFoundError('Message', messageId);

    const [pinCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.isPinned, true)));

    const isPremium = await this.getIsPremium(pinnedBy);
    const maxPinned = isPremium ? MAX_PINNED_MESSAGES_PREMIUM : MAX_PINNED_MESSAGES;
    if ((pinCount?.count ?? 0) >= maxPinned) {
      throw new BadRequestError(`Cannot pin more than ${maxPinned} messages`);
    }

    await this.db
      .update(messages)
      .set({ isPinned: true })
      .where(eq(messages.id, msgId));
  }

  async unpinMessage(messageId: string, chatId: string, unpinnedBy: string) {
    await this.requirePinPermission(chatId, unpinnedBy);

    const msgId = BigInt(messageId);
    await this.db
      .update(messages)
      .set({ isPinned: false })
      .where(and(eq(messages.id, msgId), eq(messages.chatId, chatId)));
  }

  async getPinnedMessages(chatId: string) {
    const rows = await this.db
      .select({
        id: messages.id,
        chatId: messages.chatId,
        senderId: messages.senderId,
        replyToId: messages.replyToId,
        forwardFromId: messages.forwardFromId,
        forwardFromChatId: messages.forwardFromChatId,
        contentType: messages.contentType,
        textContent: messages.textContent,
        mediaId: messages.mediaId,
        metadata: messages.metadata,
        isEdited: messages.isEdited,
        isPinned: messages.isPinned,
        selfDestructAt: messages.selfDestructAt,
        createdAt: messages.createdAt,
        editedAt: messages.editedAt,
        senderDisplayName: users.displayName,
        senderAvatarUrl: users.avatarUrl,
        senderIsPremium: users.isPremium,
        senderPremiumBadgeEmoji: users.premiumBadgeEmoji,
        senderIsVerified: users.isVerified,
        senderIsOfficial: users.isOfficial,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(and(eq(messages.chatId, chatId), eq(messages.isPinned, true)))
      .orderBy(desc(messages.createdAt));

    if (rows.length === 0) return [];

    const msgIds = rows.map((r) => r.id);
    const reactionRows = await this.db
      .select({
        messageId: reactions.messageId,
        emoji: reactions.emoji,
        count: sql<number>`count(*)::int`,
      })
      .from(reactions)
      .where(inArray(reactions.messageId, msgIds))
      .groupBy(reactions.messageId, reactions.emoji);

    const reactionsMap: Record<string, { emoji: string; count: number }[]> = {};
    for (const row of reactionRows) {
      const key = row.messageId.toString();
      if (!reactionsMap[key]) reactionsMap[key] = [];
      reactionsMap[key].push({ emoji: row.emoji, count: row.count });
    }

    return rows.map((r) => ({
      ...r,
      reactions: reactionsMap[r.id.toString()] ?? [],
    }));
  }

  async reactToMessage(messageId: string, chatId: string, userId: string, emoji: string) {
    await this.requireChatMembership(chatId, userId);

    const msgId = BigInt(messageId);
    const [message] = await this.db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.id, msgId), eq(messages.chatId, chatId)))
      .limit(1);

    if (!message) throw new NotFoundError('Message', messageId);

    const [existingReaction] = await this.db
      .select()
      .from(reactions)
      .where(and(eq(reactions.messageId, msgId), eq(reactions.userId, userId)))
      .limit(1);

    const allRows = await this.db
      .select({ userId: reactions.userId, emoji: reactions.emoji })
      .from(reactions)
      .where(eq(reactions.messageId, msgId));

    const isPremium = await this.getIsPremium(userId);
    const maxDistinct = isPremium ? MAX_REACTIONS_PER_MESSAGE_PREMIUM : MAX_REACTIONS_PER_MESSAGE;

    if (existingReaction) {
      if (existingReaction.emoji === emoji) {
        await this.db
          .delete(reactions)
          .where(and(eq(reactions.messageId, msgId), eq(reactions.userId, userId)));
      } else {
        const afterDistinct = new Set<string>();
        for (const r of allRows) {
          afterDistinct.add(r.userId === userId ? emoji : r.emoji);
        }
        if (afterDistinct.size > maxDistinct) {
          throw new BadRequestError(
            `На сообщение можно добавить не более ${maxDistinct} разных реакций (эмодзи) для вашего тарифа`,
          );
        }
        await this.db
          .update(reactions)
          .set({ emoji })
          .where(and(eq(reactions.messageId, msgId), eq(reactions.userId, userId)));
      }
    } else {
      const currentDistinct = new Set(allRows.map((r) => r.emoji));
      if (!currentDistinct.has(emoji) && currentDistinct.size >= maxDistinct) {
        throw new BadRequestError(
          `На сообщение можно добавить не более ${maxDistinct} разных реакций (эмодзи) для вашего тарифа`,
        );
      }
      await this.db.insert(reactions).values({ messageId: msgId, userId, emoji });
    }

    await this.publishMessageReactions(chatId, messageId);
  }

  async forwardMessage(
    originalMessageId: string,
    fromChatId: string,
    toChatId: string,
    senderId: string,
  ) {
    await this.requireChatMembership(toChatId, senderId);

    const origId = BigInt(originalMessageId);
    const [original] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, origId), eq(messages.chatId, fromChatId)))
      .limit(1);

    if (!original) throw new NotFoundError('Original message', originalMessageId);

    const newId = generateSnowflakeId();
    const [forwarded] = await this.db
      .insert(messages)
      .values({
        id: newId,
        chatId: toChatId,
        senderId,
        contentType: original.contentType,
        textContent: original.textContent,
        mediaId: original.mediaId,
        metadata: original.metadata,
        forwardFromId: original.id,
        forwardFromChatId: original.chatId,
      })
      .returning();

    await this.db
      .update(chats)
      .set({
        lastMessageId: newId,
        lastMessageAt: forwarded.createdAt,
        updatedAt: new Date(),
      })
      .where(eq(chats.id, toChatId));

    const memberRowsFwd = await this.db
      .select({ userId: chatMembers.userId })
      .from(chatMembers)
      .where(eq(chatMembers.chatId, toChatId));
    const memberIdsFwd = memberRowsFwd.map((r) => r.userId);

    const [senderFwd] = await this.db
      .select({
        displayName: users.displayName,
        username: users.username,
        avatarUrl: users.avatarUrl,
        isPremium: users.isPremium,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isVerified: users.isVerified,
        isOfficial: users.isOfficial,
      })
      .from(users)
      .where(eq(users.id, forwarded.senderId))
      .limit(1);

    let fwdChatTitle = '';
    let fwdSenderName = '';
    if (forwarded.forwardFromChatId) {
      const [fwdChat] = await this.db
        .select({ title: chats.title, type: chats.type })
        .from(chats)
        .where(eq(chats.id, forwarded.forwardFromChatId))
        .limit(1);
      fwdChatTitle = fwdChat?.type === 'private' ? '' : (fwdChat?.title ?? '');
    }
    if (forwarded.forwardFromId) {
      const [origMsg] = await this.db
        .select({ senderId: messages.senderId, senderName: users.displayName })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.id, forwarded.forwardFromId))
        .limit(1);
      fwdSenderName = origMsg?.senderName ?? '';
    }

    this.publish(NATS_SUBJECTS.MESSAGE_SENT, {
      id: snowflakeToString(forwarded.id),
      chatId: forwarded.chatId,
      senderId: forwarded.senderId,
      senderDisplayName: senderFwd?.displayName ?? null,
      senderUsername: senderFwd?.username ?? null,
      senderIsPremium: senderFwd?.isPremium ?? false,
      senderPremiumBadgeEmoji: senderFwd?.premiumBadgeEmoji ?? null,
      senderIsVerified: senderFwd?.isVerified ?? false,
      senderIsOfficial: senderFwd?.isOfficial ?? false,
      contentType: forwarded.contentType,
      textContent: forwarded.textContent,
      mediaId: forwarded.mediaId ?? null,
      replyToId: null,
      forwardFromId: forwarded.forwardFromId?.toString(),
      forwardFromChatId: forwarded.forwardFromChatId,
      forwardFromChatTitle: fwdChatTitle,
      forwardFromSenderName: fwdSenderName,
      metadata: forwarded.metadata && typeof forwarded.metadata === 'object' && !Array.isArray(forwarded.metadata)
        ? (forwarded.metadata as Record<string, unknown>)
        : {},
      createdAt: forwarded.createdAt.toISOString(),
      memberIds: memberIdsFwd,
    });

    return {
      ...forwarded,
      senderDisplayName: senderFwd?.displayName ?? '',
      senderAvatarUrl: senderFwd?.avatarUrl ?? null,
      senderIsPremium: senderFwd?.isPremium ?? false,
      senderPremiumBadgeEmoji: senderFwd?.premiumBadgeEmoji ?? null,
      senderIsVerified: senderFwd?.isVerified ?? false,
      senderIsOfficial: senderFwd?.isOfficial ?? false,
    };
  }

  /** Removes messages in chats with retention_days that are older than retention. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupMessagesByRetention(): Promise<number> {
    const chatsWithRetention = await this.db
      .select({ id: chats.id, retentionDays: chats.retentionDays })
      .from(chats)
      .where(sql`${chats.retentionDays} IS NOT NULL`);
    if (chatsWithRetention.length === 0) return 0;

    let totalDeleted = 0;
    const now = new Date();

    for (const chat of chatsWithRetention) {
      const days = chat.retentionDays ?? 0;
      if (days <= 0) continue;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const toDelete = await this.db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.chatId, chat.id),
            lt(messages.createdAt, cutoff),
          ),
        );
      const messageIds = toDelete.map((m) => m.id);
      if (messageIds.length === 0) continue;

      await this.db.delete(reactions).where(inArray(reactions.messageId, messageIds));
      await this.db.delete(messageStatus).where(inArray(messageStatus.messageId, messageIds));
      await this.db.delete(messages).where(inArray(messages.id, messageIds));

      for (const msg of toDelete) {
        this.publish(NATS_SUBJECTS.MESSAGE_DELETED, {
          id: msg.id.toString(),
          chatId: chat.id,
          deleterId: 'system',
          deleteForEveryone: true,
          reason: 'retention',
        });
      }
      totalDeleted += toDelete.length;
    }
    if (totalDeleted > 0) {
      console.log(`Cleanup retention: deleted ${totalDeleted} messages`);
    }
    return totalDeleted;
  }

  async cleanupSelfDestructingMessages() {
    const now = new Date();
    const expired = await this.db
      .select({ id: messages.id, chatId: messages.chatId })
      .from(messages)
      .where(
        and(
          sql`${messages.selfDestructAt} IS NOT NULL`,
          lt(messages.selfDestructAt, now),
        ),
      );

    for (const msg of expired) {
      await this.db.delete(messages).where(eq(messages.id, msg.id));
      this.publish(NATS_SUBJECTS.MESSAGE_DELETED, {
        id: msg.id.toString(),
        chatId: msg.chatId,
        deleterId: 'system',
        deleteForEveryone: true,
        reason: 'self_destruct',
      });
    }

    return expired.length;
  }

  /** Clears all messages in a chat. Allowed only for saved (Избранное) chats. */
  async clearChatMessages(chatId: string, userId: string): Promise<void> {
    const [chat] = await this.db
      .select({ id: chats.id, type: chats.type })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat) throw new NotFoundError('Chat', chatId);
    if (chat.type !== 'saved') {
      throw new BadRequestError('Only Saved Messages (Избранное) chat can be cleared');
    }

    await this.requireChatMembership(chatId, userId);

    const chatMessages = await this.db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatId, chatId));
    const messageIds = chatMessages.map((m) => m.id);

    if (messageIds.length > 0) {
      await this.db.delete(reactions).where(inArray(reactions.messageId, messageIds));
      await this.db.delete(messageStatus).where(inArray(messageStatus.messageId, messageIds));
    }

    await this.db.delete(messages).where(eq(messages.chatId, chatId));
    await this.db
      .update(chats)
      .set({ lastMessageId: null, lastMessageAt: null, updatedAt: new Date() })
      .where(eq(chats.id, chatId));
  }

  /** Очистка всех сообщений в чате админом (любой тип чата; проверка прав — в gateway). */
  async clearChatMessagesAdmin(chatId: string): Promise<void> {
    const [chat] = await this.db
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);
    if (!chat) throw new NotFoundError('Chat', chatId);

    const chatMessages = await this.db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatId, chatId));
    const messageIds = chatMessages.map((m) => m.id);
    if (messageIds.length > 0) {
      await this.db.delete(reactions).where(inArray(reactions.messageId, messageIds));
      await this.db.delete(messageStatus).where(inArray(messageStatus.messageId, messageIds));
    }
    await this.db.delete(messages).where(eq(messages.chatId, chatId));
    await this.db
      .update(chats)
      .set({ lastMessageId: null, lastMessageAt: null, updatedAt: new Date() })
      .where(eq(chats.id, chatId));
  }

  private async requireChatMembership(chatId: string, userId: string): Promise<void> {
    const [member] = await this.db
      .select({ userId: chatMembers.userId })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
      .limit(1);

    if (!member) throw new ForbiddenError('Not a member of this chat');
  }

  private async isAdminOrOwner(chatId: string, userId: string): Promise<boolean> {
    const [member] = await this.db
      .select({ role: chatMembers.role })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
      .limit(1);

    return member?.role === 'owner' || member?.role === 'admin';
  }

  private async requirePinPermission(chatId: string, userId: string): Promise<void> {
    const [chat] = await this.db
      .select({ type: chats.type })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (chat?.type === 'private' || chat?.type === 'saved') {
      await this.requireChatMembership(chatId, userId);
      return;
    }

    await this.requirePermissionForChat(chatId, userId, 'canPinMessages');
  }

  private async requirePermissionForChat(
    chatId: string,
    userId: string,
    permission: string,
  ): Promise<void> {
    const [member] = await this.db
      .select({ role: chatMembers.role, permissions: chatMembers.permissions })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
      .limit(1);

    if (!member) throw new ForbiddenError('Not a member of this chat');
    if (member.role === 'owner' || member.role === 'admin') return;

    const perms = (member.permissions ?? {}) as Record<string, boolean>;
    if (!perms[permission]) {
      throw new ForbiddenError('Insufficient permissions');
    }
  }
}
