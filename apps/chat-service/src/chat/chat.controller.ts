import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  AlufError,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnauthorizedError,
} from '@aluf/shared';
import { ChatService } from './chat.service';
import { GroupChannelService } from './group-channel/group-channel.service';
import { MemberManagementService } from './group-channel/member-management.service';
import { GroupChannelAdminService } from './group-channel/group-channel-admin.service';

const PROTO_TO_DB_CHAT_TYPE: Record<number, string> = {
  0: 'private',
  1: 'private',
  2: 'group',
  3: 'channel',
  4: 'supergroup',
  5: 'saved',
};

/** Proto ChatType enum names (enums: String in loader). */
const PROTO_CHAT_TYPE_BY_NAME: Record<string, string> = {
  CHAT_TYPE_UNSPECIFIED: 'private',
  CHAT_TYPE_DIRECT: 'private',
  CHAT_TYPE_GROUP: 'group',
  CHAT_TYPE_CHANNEL: 'channel',
  CHAT_TYPE_SUPERGROUP: 'supergroup',
  CHAT_TYPE_SAVED: 'saved',
};

function normalizeChatType(value: number | string | undefined): string | null {
  if (value === undefined || value === null) return PROTO_TO_DB_CHAT_TYPE[0] ?? null;
  if (typeof value === 'string') {
    const byName = PROTO_CHAT_TYPE_BY_NAME[value];
    if (byName) return byName;
    const num = parseInt(value, 10);
    if (!Number.isNaN(num) && num in PROTO_TO_DB_CHAT_TYPE) return PROTO_TO_DB_CHAT_TYPE[num as keyof typeof PROTO_TO_DB_CHAT_TYPE];
    return null;
  }
  return PROTO_TO_DB_CHAT_TYPE[value] ?? null;
}

const DB_TO_PROTO_CHAT_TYPE: Record<string, number> = {
  private: 1,
  group: 2,
  channel: 3,
  supergroup: 4,
  saved: 5,
};

const PROTO_TO_DB_ROLE: Record<number, string> = {
  1: 'member',
  2: 'admin',
  3: 'owner',
};

const DB_TO_PROTO_ROLE: Record<string, number> = {
  member: 1,
  admin: 2,
  moderator: 2,
  owner: 3,
};

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError) code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof NotFoundError) code = GrpcStatus.NOT_FOUND;
    else if (err instanceof ForbiddenError) code = GrpcStatus.PERMISSION_DENIED;
    else if (err instanceof UnauthorizedError) code = GrpcStatus.UNAUTHENTICATED;
    else if (err instanceof ConflictError) code = GrpcStatus.ALREADY_EXISTS;
    return new RpcException({ code, message: err.message });
  }
  return new RpcException({
    code: GrpcStatus.INTERNAL,
    message: err instanceof Error ? err.message : 'Internal server error',
  });
}

function toGrpcTimestamp(date: Date): { seconds: number; nanos: number } {
  const ms = date.getTime();
  return { seconds: Math.floor(ms / 1000), nanos: (ms % 1000) * 1_000_000 };
}

function fromGrpcTimestamp(ts: { seconds: number; nanos: number } | undefined): Date | undefined {
  if (!ts || (!ts.seconds && !ts.nanos)) return undefined;
  return new Date(ts.seconds * 1000 + ts.nanos / 1_000_000);
}

function toChatResponse(
  chat: {
    id: string;
    type: string;
    title: string | null;
    description: string | null;
    avatarUrl: string | null;
    username?: string | null;
    createdBy: string;
    settings: unknown;
    memberCount: number;
    createdAt: Date;
    updatedAt: Date;
  },
  lastMessage?: {
    id: bigint;
    senderId: string;
    textContent: string | null;
    contentType: string;
    createdAt: Date;
    senderDisplayName?: string | null;
  } | null,
  otherMember?: { userId?: string; displayName: string; avatarUrl: string | null; isBot: boolean; isPremium?: boolean },
  isPinned?: boolean,
  myMember?: { role: string; canPostMessages: boolean },
  memberFlags?: { isArchived?: boolean; isMuted?: boolean },
) {
  const settings = (chat.settings ?? {}) as Record<string, unknown>;
  const name = otherMember ? otherMember.displayName : (chat.title ?? '');
  const avatarUrl = otherMember ? (otherMember.avatarUrl ?? '') : (chat.avatarUrl ?? '');
  return {
    id: chat.id,
    type: DB_TO_PROTO_CHAT_TYPE[chat.type] ?? 0,
    name,
    description: chat.description ?? '',
    avatarUrl,
    username: chat.username ?? '',
    creatorId: chat.createdBy,
    isPublic: !(settings.joinApprovalRequired ?? false),
    memberCount: chat.memberCount,
    slowModeSeconds: (settings.slowModeInterval as number) ?? 0,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id.toString(),
          senderId: lastMessage.senderId,
          textContent: lastMessage.textContent ?? '',
          contentType: lastMessage.contentType,
          sentAt: toGrpcTimestamp(lastMessage.createdAt),
          senderDisplayName: lastMessage.senderDisplayName ?? '',
        }
      : undefined,
    unreadCount: 0,
    isPinned: isPinned ?? false,
    isMuted: memberFlags?.isMuted ?? false,
    isArchived: memberFlags?.isArchived ?? false,
    createdAt: toGrpcTimestamp(chat.createdAt),
    updatedAt: toGrpcTimestamp(chat.updatedAt),
    isBot: otherMember?.isBot ?? false,
    myRole: myMember?.role ?? '',
    canPostMessages: myMember?.canPostMessages ?? true,
    isPremium: otherMember?.isPremium ?? false,
    otherUserId: otherMember?.userId ?? '',
  };
}

@Controller()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly groupChannelService: GroupChannelService,
    private readonly memberManagementService: MemberManagementService,
    private readonly groupChannelAdminService: GroupChannelAdminService,
  ) {}

  @GrpcMethod('ChatService', 'CreateChat')
  async createChat(data: {
    type?: number;
    name?: string;
    description?: string;
    avatarUrl?: string;
    avatar_url?: string;
    creatorId?: string;
    creator_id?: string;
    memberIds?: string[];
    member_ids?: string[];
    username?: string;
  }) {
    try {
      const dbType = normalizeChatType(data.type);
      if (!dbType) throw new BadRequestError('Invalid chat type');

      const creatorId = data.creatorId ?? data.creator_id ?? '';
      if (!creatorId) throw new BadRequestError('creatorId is required');

      const name = data.name ?? '';
      const description = data.description ?? '';
      const avatarUrl = data.avatarUrl ?? data.avatar_url ?? '';
      const memberIds = Array.isArray(data.memberIds) ? data.memberIds : (Array.isArray(data.member_ids) ? data.member_ids : []);
      const optionalUsername = (dbType === 'channel' || dbType === 'group') ? (data.username ?? '').trim() || undefined : undefined;

      const chat = (dbType === 'group' || dbType === 'channel' || dbType === 'supergroup')
        ? await this.groupChannelService.create({
            type: dbType as 'group' | 'channel' | 'supergroup',
            creatorId,
            title: name,
            description,
            avatarUrl,
            memberIds,
            username: optionalUsername,
          })
        : await this.chatService.createChat(
            dbType,
            creatorId,
            name,
            description,
            avatarUrl,
            memberIds,
            optionalUsername,
          );

      return toChatResponse(chat);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'GetChat')
  async getChat(data: { chatId: string; userId?: string; user_id?: string }) {
    try {
      const userId = data.userId ?? data.user_id;
      const result = await this.chatService.getChatWithLastMessage(data.chatId, userId);
      return toChatResponse(result.chat, result.lastMessage, result.otherMember, undefined, result.myMember);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'ListChats')
  async listChats(data: { limit?: number; offset?: number; type?: number }) {
    try {
      const limit = Math.min(Math.max(1, data.limit ?? 20), 100);
      const offset = Math.max(0, data.offset ?? 0);
      const type = data.type !== undefined && data.type !== 0 ? data.type : undefined;
      const { chats: chatsList, totalCount } = await this.chatService.listChats(limit, offset, type);
      return {
        chats: chatsList.map((chat) =>
          toChatResponse({
            id: chat.id,
            type: chat.type,
            title: chat.title,
            description: chat.description,
            avatarUrl: chat.avatarUrl,
            username: chat.username,
            createdBy: chat.createdBy,
            settings: chat.settings,
            memberCount: chat.memberCount,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
          }),
        ),
        totalCount,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'GetUserChats')
  async getUserChats(data: { userId: string; limit: number; cursor: string }) {
    try {
      const result = await this.chatService.getUserChats(
        data.userId,
        data.cursor || undefined,
        data.limit,
      );
      return {
        chats: result.chats.map((item) =>
        toChatResponse(item.chat, item.lastMessage, item.otherMember, item.isPinned, {
          role: item.myRole,
          canPostMessages: item.canPostMessages,
        }, {
          isArchived: item.isArchived,
          isMuted: item.isMuted,
        }),
      ),
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'UpdateChat')
  async updateChat(data: {
    chatId: string;
    userId: string;
    name?: string;
    description?: string;
    avatarUrl?: string;
    username?: string;
    isPublic?: boolean;
    slowModeSeconds?: number;
  }) {
    try {
      const updated = await this.chatService.updateChat(data.chatId, data.userId, {
        title: data.name,
        description: data.description,
        avatarUrl: data.avatarUrl,
        username: data.username,
        isPublic: data.isPublic,
        slowModeSeconds: data.slowModeSeconds,
      });
      return toChatResponse(updated);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'GetChannelByUsername')
  async getChannelByUsername(data: { username: string }) {
    try {
      const chat = await this.chatService.getChatByUsername(data.username ?? '');
      return toChatResponse(chat);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'DeleteChat')
  async deleteChat(data: { chatId: string; userId: string }) {
    try {
      await this.chatService.deleteChat(data.chatId, data.userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'DeleteChatAdmin')
  async deleteChatAdmin(data: { chatId?: string; chat_id?: string }) {
    try {
      const chatId = data.chatId ?? data.chat_id ?? '';
      await this.chatService.deleteChatAdmin(chatId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'AddMembers')
  async addMembers(data: { chatId: string; addedBy: string; userIds: string[] }) {
    try {
      await this.memberManagementService.addMembers(data.chatId, data.addedBy, data.userIds ?? []);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'RemoveMember')
  async removeMember(data: { chatId: string; removedBy: string; userId: string }) {
    try {
      await this.memberManagementService.removeMember(data.chatId, data.removedBy, data.userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'GetMembers')
  async getMembers(data: {
    chatId: string;
    limit: number;
    offset: number;
    viewerUserId?: string;
    viewer_user_id?: string;
  }) {
    try {
      const viewerUserId = data.viewerUserId ?? data.viewer_user_id ?? '';
      const result = await this.chatService.getMembers(
        data.chatId,
        data.limit,
        data.offset,
        viewerUserId || undefined,
      );
      return {
        members: result.members.map((m) => ({
          userId: m.userId,
          chatId: m.chatId,
          role: DB_TO_PROTO_ROLE[m.role] ?? 1,
          joinedAt: toGrpcTimestamp(m.joinedAt),
          displayName: m.displayName ?? '',
          avatarUrl: m.avatarUrl ?? '',
          isOnline: false,
          notificationsMuted: false,
          isBot: m.isBot ?? false,
          isPremium: m.isPremium ?? false,
          premiumBadgeEmoji: m.premiumBadgeEmoji ?? '',
        })),
        totalCount: result.totalCount,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'UpdateMemberRole')
  async updateMemberRole(data: {
    chatId: string;
    updatedBy: string;
    userId: string;
    role: number;
  }) {
    try {
      const dbRole = PROTO_TO_DB_ROLE[data.role];
      if (!dbRole) throw new BadRequestError('Invalid role');
      await this.memberManagementService.updateRole(
        data.chatId,
        data.updatedBy,
        data.userId,
        dbRole as 'member' | 'admin' | 'owner',
      );
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'JoinChat')
  async joinChat(data: { chatId: string; userId: string; inviteLink: string }) {
    try {
      const chat = await this.chatService.joinChat(
        data.chatId,
        data.userId,
        data.inviteLink || undefined,
      );
      return toChatResponse(chat);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'LeaveChat')
  async leaveChat(data: { chatId: string; userId: string }) {
    try {
      await this.chatService.leaveChat(data.chatId, data.userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'PinChat')
  async pinChat(data: { chatId: string; chat_id?: string; userId: string; user_id?: string }) {
    try {
      const chatId = data.chatId ?? data.chat_id ?? '';
      const userId = data.userId ?? data.user_id ?? '';
      await this.chatService.pinChat(chatId, userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'UnpinChat')
  async unpinChat(data: { chatId: string; chat_id?: string; userId: string; user_id?: string }) {
    try {
      const chatId = data.chatId ?? data.chat_id ?? '';
      const userId = data.userId ?? data.user_id ?? '';
      await this.chatService.unpinChat(chatId, userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'CreateInviteLink')
  async createInviteLink(data: {
    chatId: string;
    createdBy?: string;
    created_by?: string;
    maxUses?: number;
    expiresAt?: { seconds: number; nanos: number };
  }) {
    try {
      const createdBy = data.createdBy ?? data.created_by ?? '';
      const link = await this.groupChannelAdminService.createInviteLink(
        data.chatId,
        createdBy,
        data.maxUses || undefined,
        fromGrpcTimestamp(data.expiresAt),
      );
      return {
        link: link.code,
        chatId: link.chatId,
        createdBy: link.createdBy,
        maxUses: link.usageLimit ?? 0,
        useCount: link.usageCount,
        expiresAt: link.expiresAt ? toGrpcTimestamp(link.expiresAt) : undefined,
        createdAt: toGrpcTimestamp(link.createdAt),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'GetChatByInviteLink')
  async getChatByInviteLink(data: { inviteLink?: string; invite_link?: string; code?: string }) {
    try {
      const code = data.inviteLink ?? data.invite_link ?? data.code ?? '';
      const chat = await this.groupChannelAdminService.getChatByInviteLink(code);
      return toChatResponse(chat);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'GetChannelSubscribers')
  async getChannelSubscribers(data: {
    chatId: string;
    userId: string;
    limit: number;
    cursor: string;
  }) {
    try {
      const result = await this.chatService.getChannelSubscribers(
        data.chatId,
        data.userId,
        data.cursor || undefined,
        data.limit,
      );
      return {
        subscribers: result.subscribers.map((s) => ({
          chatId: s.chatId,
          userId: s.userId,
          displayName: s.displayName,
          avatarUrl: s.avatarUrl ?? '',
          username: s.username ?? '',
          isBot: s.isBot,
          isPremium: s.isPremium,
          subscribedAt: toGrpcTimestamp(s.subscribedAt),
          notificationsEnabled: s.notificationsEnabled,
          lastActivityAt: s.lastActivityAt ? toGrpcTimestamp(s.lastActivityAt) : undefined,
        })),
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'GetChannelStats')
  async getChannelStats(data: { chatId: string; periodDays: number }) {
    try {
      const stats = await this.chatService.getChannelStats(
        data.chatId,
        data.periodDays || 7,
      );
      return {
        chatId: stats.chatId,
        totalSubscribers: stats.totalSubscribers,
        subscriberGrowth: stats.subscriberGrowth,
        totalViews: stats.totalViews.toString(),
        avgViewsPerPost: stats.avgViewsPerPost,
        totalReactions: stats.totalReactions.toString(),
        totalForwards: stats.totalForwards.toString(),
        reach: stats.reach,
        engagement: stats.engagement,
        periodFrom: toGrpcTimestamp(stats.period.from),
        periodTo: toGrpcTimestamp(stats.period.to),
        dailyStats: stats.dailyStats.map((d) => ({
          id: d.id,
          chatId: d.chatId,
          date: toGrpcTimestamp(d.date),
          totalSubscribers: d.totalSubscribers,
          newSubscribers: d.newSubscribers,
          unsubscribers: d.unsubscribers,
          totalViews: d.totalViews.toString(),
          totalReactions: d.totalReactions.toString(),
          totalForwards: d.totalForwards.toString(),
          messagesSent: d.messagesSent,
          reach: d.reach,
        })),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'LinkDiscussionGroup')
  async linkDiscussionGroup(data: {
    channelId: string;
    groupId: string;
    userId: string;
  }) {
    try {
      const chat = await this.groupChannelAdminService.linkDiscussionGroup(
        data.channelId,
        data.groupId,
        data.userId,
      );
      return toChatResponse(chat);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'UnlinkDiscussionGroup')
  async unlinkDiscussionGroup(data: { channelId: string; userId: string }) {
    try {
      const chat = await this.groupChannelAdminService.unlinkDiscussionGroup(
        data.channelId,
        data.userId,
      );
      return toChatResponse(chat);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  // === Новые методы для расширенных функций групп ===

  @GrpcMethod('ChatService', 'BanMember')
  async banMember(data: {
    chatId: string;
    bannedBy: string;
    userId: string;
    reason: string;
    expiresAt?: { seconds: number; nanos: number };
    deleteMessages: boolean;
  }) {
    try {
      await this.groupChannelAdminService.banMember(
        data.chatId,
        data.bannedBy,
        data.userId,
        data.reason || '',
        fromGrpcTimestamp(data.expiresAt) || null,
        data.deleteMessages ?? false,
      );
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'UnbanMember')
  async unbanMember(data: { chatId: string; unbannedBy: string; userId: string }) {
    try {
      await this.groupChannelAdminService.unbanMember(data.chatId, data.unbannedBy, data.userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'GetBannedMembers')
  async getBannedMembers(data: { chatId: string; limit: number; offset: number }) {
    try {
      const result = await this.groupChannelAdminService.getBannedMembers(data.chatId, data.limit, data.offset);
      return {
        members: result.members.map((m) => ({
          userId: m.userId,
          chatId: m.chatId,
          bannedBy: m.bannedBy,
          bannedByName: m.bannedByDisplayName ?? '',
          reason: m.reason ?? '',
          expiresAt: m.expiresAt ? toGrpcTimestamp(m.expiresAt) : undefined,
          createdAt: toGrpcTimestamp(m.createdAt),
          displayName: m.displayName ?? '',
          avatarUrl: m.avatarUrl ?? '',
        })),
        totalCount: result.totalCount,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'GetAuditLog')
  async getAuditLog(data: { chatId: string; limit: number; offset: number; actionFilter?: string }) {
    try {
      const result = await this.groupChannelAdminService.getAuditLog(data.chatId, data.limit, data.offset, data.actionFilter);
      return {
        entries: result.entries.map((e) => ({
          id: e.id,
          chatId: e.chatId,
          actorId: e.actorId,
          actorName: e.actorName ?? '',
          action: e.action,
          targetUserId: e.targetUserId ?? '',
          targetUserName: e.targetUserName ?? '',
          details: e.details as Record<string, unknown>,
          createdAt: toGrpcTimestamp(e.createdAt),
        })),
        totalCount: result.totalCount,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'UpdateModerationSettings')
  async updateModerationSettings(data: {
    chatId: string;
    updatedBy: string;
    settings: {
      forbiddenWords?: string[];
      forbiddenWordsMode?: 'warn' | 'delete' | 'ban';
      antiSpamEnabled?: boolean;
      antiSpamMessagesLimit?: number;
      antiSpamTimeWindow?: number;
      antiSpamAction?: 'warn' | 'mute' | 'ban';
      linksAllowed?: boolean;
      linksRequireApproval?: boolean;
      captchaEnabled?: boolean;
      captchaTimeout?: number;
      mediaRequireApproval?: boolean;
      autoDeleteSpam?: boolean;
      autoBanRepeatOffenders?: boolean;
    };
  }) {
    try {
      const settings = await this.groupChannelAdminService.updateModerationSettings(
        data.chatId,
        data.updatedBy,
        data.settings || {},
      );
      return { settings };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'GetModerationSettings')
  async getModerationSettings(data: { chatId: string }) {
    try {
      const settings = await this.groupChannelAdminService.getModerationSettings(data.chatId);
      return { settings };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  // === Методы для тем/топиков ===

  @GrpcMethod('ChatService', 'CreateTopic')
  async createTopic(data: { chatId: string; createdBy: string; title: string; icon?: string; color?: number }) {
    try {
      const topic = await this.groupChannelAdminService.createTopic(
        data.chatId,
        data.createdBy,
        data.title,
        data.icon,
        data.color,
      );
      return { topic: toTopicResponse(topic) };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'UpdateTopic')
  async updateTopic(data: {
    chatId: string;
    topicId: string;
    updatedBy: string;
    title?: string;
    icon?: string;
    color?: number;
  }) {
    try {
      const topic = await this.groupChannelAdminService.updateTopic(data.chatId, data.topicId, data.updatedBy, {
        title: data.title,
        icon: data.icon,
        color: data.color,
      });
      return { topic: toTopicResponse(topic) };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'DeleteTopic')
  async deleteTopic(data: { chatId: string; topicId: string; deletedBy: string }) {
    try {
      await this.groupChannelAdminService.deleteTopic(data.chatId, data.topicId, data.deletedBy);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'GetTopics')
  async getTopics(data: { chatId: string; limit: number; offset: number }) {
    try {
      const result = await this.groupChannelAdminService.getTopics(data.chatId, data.limit, data.offset);
      return {
        topics: result.topics.map((t) => toTopicResponse(t)),
        totalCount: result.totalCount,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'ToggleTopic')
  async toggleTopic(data: { chatId: string; topicId: string; toggledBy: string; isClosed: boolean }) {
    try {
      await this.groupChannelAdminService.toggleTopic(data.chatId, data.topicId, data.toggledBy, data.isClosed);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'MuteChat')
  async muteChat(data: { chatId: string; userId: string; mutedUntil?: { seconds: number; nanos: number } }) {
    try {
      const until = data.mutedUntil ? new Date(data.mutedUntil.seconds * 1000) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await this.groupChannelService.mute(data.chatId, data.userId, until);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'UnmuteChat')
  async unmuteChat(data: { chatId: string; userId: string }) {
    try {
      await this.groupChannelService.unmute(data.chatId, data.userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'ArchiveChat')
  async archiveChat(data: { chatId: string; userId: string }) {
    try {
      await this.groupChannelService.archive(data.chatId, data.userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('ChatService', 'UnarchiveChat')
  async unarchiveChat(data: { chatId: string; userId: string }) {
    try {
      await this.groupChannelService.unarchive(data.chatId, data.userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}

function toTopicResponse(topic: {
  id: string;
  chatId: string;
  title: string;
  icon: string | null;
  color: number | null;
  createdBy: string;
  isClosed: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdByName?: string | null;
}) {
  return {
    id: topic.id,
    chatId: topic.chatId,
    title: topic.title,
    icon: topic.icon ?? '',
    color: topic.color ?? 0,
    createdBy: topic.createdBy,
    createdByName: topic.createdByName ?? '',
    isClosed: topic.isClosed,
    isPinned: topic.isPinned,
    messageCount: 0,
    createdAt: toGrpcTimestamp(topic.createdAt),
    updatedAt: toGrpcTimestamp(topic.updatedAt),
  };
}
