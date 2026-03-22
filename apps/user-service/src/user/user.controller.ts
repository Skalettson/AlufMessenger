import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { AlufError, BadRequestError, ConflictError, NotFoundError } from '@aluf/shared';
import { UserService } from './user.service';

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError) code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof NotFoundError) code = GrpcStatus.NOT_FOUND;
    else if (err instanceof ConflictError) code = GrpcStatus.ALREADY_EXISTS;

    return new RpcException({ code, message: (err as Error).message });
  }
  return new RpcException({
    code: GrpcStatus.INTERNAL,
    message: err instanceof Error ? err.message : 'Internal server error',
  });
}

function toGrpcTimestamp(date: Date): { seconds: number; nanos: number } {
  const ms = date.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanos: (ms % 1000) * 1_000_000,
  };
}

function toUserResponse(
  row: {
    id: string;
    alufId: bigint;
    username: string;
    displayName: string;
    phone: string | null;
    email: string | null;
    avatarStorageKey: string | null;
    coverStorageKey: string | null;
    avatarUrl: string | null;
    coverUrl?: string | null;
    bio: string | null;
    statusText: string | null;
    statusEmoji: string | null;
    premiumBadgeEmoji?: string | null;
    isPremium: boolean;
    createdAt: Date;
    lastSeenAt: Date | null;
    isBot?: boolean;
    botCommands?: { command: string; description: string }[];
    twoFactorEnabled?: boolean;
  } & { isOnline?: boolean; isContact?: boolean },
  opts?: { includeTwoFactor?: boolean },
) {
  const includeTwoFactor = opts?.includeTwoFactor === true;
  const botCommands = row.botCommands ?? [];
  // Возвращаем storageKey в поле avatarUrl/coverUrl - API Gateway сгенерирует presigned URL
  // Приоритет: avatarStorageKey > avatarUrl (старое поле для обратной совместимости)
  return {
    id: row.id,
    alufId: String(row.alufId),
    username: row.username,
    displayName: row.displayName,
    phone: row.phone ?? '',
    email: row.email ?? '',
    avatarUrl: row.avatarStorageKey ?? row.avatarUrl ?? '',
    coverUrl: row.coverStorageKey ?? row.coverUrl ?? '',
    bio: row.bio ?? '',
    statusText: row.statusText ?? '',
    statusEmoji: row.statusEmoji ?? '',
    premiumBadgeEmoji: row.premiumBadgeEmoji ?? '',
    isPremium: row.isPremium,
    isOnline: row.isOnline ?? false,
    lastSeenAt: row.lastSeenAt ? toGrpcTimestamp(row.lastSeenAt) : undefined,
    createdAt: toGrpcTimestamp(row.createdAt),
    isBot: row.isBot ?? false,
    isVerified: (row as any).isVerified ?? false,
    isOfficial: (row as any).isOfficial ?? false,
    botCommands: botCommands.map((c) => ({ command: c.command, description: c.description })),
    isContact: row.isContact ?? false,
    isTwoFactorEnabled: includeTwoFactor ? Boolean(row.twoFactorEnabled) : false,
  };
}

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @GrpcMethod('UserService', 'GetUser')
  async getUser(data: {
    userId?: string;
    user_id?: string;
    viewerUserId?: string;
    viewer_user_id?: string;
  }) {
    try {
      const id = (data.userId ?? data.user_id ?? '').trim();
      if (!id) {
        throw new BadRequestError('userId is required');
      }
      const viewer = (data.viewerUserId ?? data.viewer_user_id ?? '').trim();
      const user = await this.userService.getUserById(id, viewer || undefined);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      const includeTwoFactor = !viewer || viewer === id;
      return toUserResponse(user, { includeTwoFactor });
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'GetUserByUsername')
  async getUserByUsername(data: { username: string }) {
    try {
      const user = await this.userService.getUserByUsername(data.username);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return toUserResponse(user, { includeTwoFactor: false });
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'GetUsersByIds')
  async getUsersByIds(data: { userIds: string[] }) {
    try {
      const users = await this.userService.getUsersByIds(data.userIds ?? []);
      return {
        users: users.map((u) => toUserResponse(u, { includeTwoFactor: false })),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'UpdateProfile')
  async updateProfile(data: {
    userId?: string;
    user_id?: string;
    displayName?: string;
    display_name?: string;
    username?: string;
    bio?: string;
    avatarUrl?: string;
    avatar_url?: string;
    coverUrl?: string;
    cover_url?: string;
    statusText?: string;
    status_text?: string;
    statusEmoji?: string;
    status_emoji?: string;
    premiumBadgeEmoji?: string | null;
    premium_badge_emoji?: string | null;
  }) {
    try {
      const userId = data.userId ?? data.user_id ?? '';
      if (!userId) throw new BadRequestError('userId is required');

      const avatarVal = data.avatarUrl ?? data.avatar_url;
      const coverVal = data.coverUrl ?? data.cover_url;
      const isStorageKey = (v?: string) => v && !v.startsWith('http://') && !v.startsWith('https://');

      const user = await this.userService.updateProfile(userId, {
        displayName: data.displayName ?? data.display_name,
        username: data.username,
        bio: data.bio,
        avatarUrl: avatarVal && !isStorageKey(avatarVal) ? avatarVal : undefined,
        coverUrl: coverVal && !isStorageKey(coverVal) ? coverVal : undefined,
        avatarStorageKey: isStorageKey(avatarVal) ? avatarVal : undefined,
        coverStorageKey: isStorageKey(coverVal) ? coverVal : undefined,
        statusText: data.statusText ?? data.status_text,
        statusEmoji: data.statusEmoji ?? data.status_emoji,
        premiumBadgeEmoji: data.premiumBadgeEmoji ?? data.premium_badge_emoji,
      });
      const withOnline = await this.userService.getUserById(user.id);
      return toUserResponse(withOnline ?? { ...user, isOnline: false }, { includeTwoFactor: true });
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'SearchUsers')
  async searchUsers(data: {
    query: string;
    limit?: number;
    offset?: number;
    requesterId?: string;
  }) {
    try {
      const limit = Math.min(data.limit ?? 50, 100);
      const offset = data.offset ?? 0;
      const { users: usersList, totalCount } = await this.userService.searchUsers(
        data.query ?? '',
        limit,
        offset,
      );
      return {
        users: usersList.map((u) => toUserResponse(u, { includeTwoFactor: false })),
        totalCount,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'GetContacts')
  async getContacts(data: {
    userId?: string;
    user_id?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      const uid = (data.userId ?? data.user_id ?? '').trim();
      if (!uid) {
        throw new BadRequestError('userId is required');
      }
      const limit = Math.min(data.limit ?? 50, 100);
      const offset = data.offset ?? 0;
      const { contacts: contactsList, totalCount } =
        await this.userService.getContacts(uid, limit, offset);
      return {
        contacts: contactsList.map((c) => ({
          userId: c.userId,
          contactUserId: c.contactUserId,
          nickname: c.customName ?? '',
          isBlocked: c.isBlocked ?? false,
          user: toUserResponse(c.contactUser, { includeTwoFactor: false }),
          addedAt: toGrpcTimestamp(c.createdAt),
        })),
        totalCount,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'AddContact')
  async addContact(data: {
    userId?: string;
    user_id?: string;
    contactUserId?: string;
    contact_user_id?: string;
    nickname?: string;
  }) {
    try {
      const uid = (data.userId ?? data.user_id ?? '').trim();
      const cid = (data.contactUserId ?? data.contact_user_id ?? '').trim();
      if (!uid || !cid) {
        throw new BadRequestError('userId and contactUserId are required');
      }
      const result = await this.userService.addContact(
        uid,
        cid,
        data.nickname,
      );
      return {
        userId: result.userId,
        contactUserId: result.contactUserId,
        nickname: result.customName ?? '',
        isBlocked: result.isBlocked ?? false,
        user: toUserResponse(result.contactUser, { includeTwoFactor: false }),
        addedAt: toGrpcTimestamp(result.createdAt),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'UpdateContact')
  async updateContact(data: {
    userId?: string;
    user_id?: string;
    contactUserId?: string;
    contact_user_id?: string;
    nickname?: string;
  }) {
    try {
      const userId = (data.userId ?? data.user_id ?? '').trim();
      const contactUserId = (data.contactUserId ?? data.contact_user_id ?? '').trim();
      const nickname = (data.nickname ?? '').trim();
      if (!userId || !contactUserId) throw new BadRequestError('userId and contactUserId are required');
      const result = await this.userService.updateContactNickname(userId, contactUserId, nickname || null);
      return {
        userId: result.userId,
        contactUserId: result.contactUserId,
        nickname: result.customName ?? '',
        isBlocked: result.isBlocked ?? false,
        user: toUserResponse(result.contactUser, { includeTwoFactor: false }),
        addedAt: toGrpcTimestamp(result.createdAt),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'RemoveContact')
  async removeContact(data: { userId: string; contactUserId: string }) {
    try {
      await this.userService.removeContact(data.userId, data.contactUserId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'BlockUser')
  async blockUser(data: { userId: string; blockedUserId: string }) {
    try {
      await this.userService.blockUser(data.userId, data.blockedUserId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'UnblockUser')
  async unblockUser(data: { userId: string; blockedUserId: string }) {
    try {
      await this.userService.unblockUser(data.userId, data.blockedUserId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'UpdatePrivacy')
  async updatePrivacy(data: {
    userId: string;
    settings?: {
      lastSeen?: number;
      profilePhoto?: number;
      about?: number;
      groups?: number;
      calls?: number;
      forwardedMessages?: number;
      readReceipts?: boolean;
    };
  }) {
    try {
      await this.userService.updatePrivacy(data.userId, data.settings ?? {});
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'ListUsers')
  async listUsers(data: { limit?: number; offset?: number; search?: string }) {
    try {
      const limit = Math.min(Math.max(1, data.limit ?? 20), 100);
      const offset = Math.max(0, data.offset ?? 0);
      const { users: usersList, totalCount } = await this.userService.listUsers(
        limit,
        offset,
        data.search?.trim() || undefined,
      );
      return {
        users: usersList.map((u) => toUserResponse(u, { includeTwoFactor: false })),
        totalCount,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'GetAdminStats')
  async getAdminStats() {
    try {
      return await this.userService.getAdminStats();
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'AdminUpdateUser')
  async adminUpdateUser(data: {
    userId?: string;
    user_id?: string;
    isVerified?: boolean;
    is_verified?: boolean;
    isOfficial?: boolean;
    is_official?: boolean;
    isPremium?: boolean;
    is_premium?: boolean;
    isBot?: boolean;
    is_bot?: boolean;
  }) {
    try {
      const userId = data.userId ?? data.user_id ?? '';
      if (!userId) throw new BadRequestError('userId is required');
      const user = await this.userService.adminUpdateUser(userId, {
        isVerified: data.isVerified ?? data.is_verified,
        isOfficial: data.isOfficial ?? data.is_official,
        isPremium: data.isPremium ?? data.is_premium,
        isBot: data.isBot ?? data.is_bot,
      });
      const withOnline = await this.userService.getUserById(user.id);
      return toUserResponse(withOnline ?? { ...user, isOnline: false }, { includeTwoFactor: true });
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('UserService', 'GetPrivacy')
  async getPrivacy(data: { userId: string }) {
    try {
      const settings = await this.userService.getPrivacy(data.userId);
      if (!settings) {
        throw new NotFoundError('User not found');
      }
      return {
        lastSeen: settings.lastSeen ?? 0,
        profilePhoto: settings.profilePhoto ?? 0,
        about: settings.about ?? 0,
        groups: settings.groups ?? 0,
        calls: settings.calls ?? 0,
        forwardedMessages: settings.forwardedMessages ?? 0,
        readReceipts: settings.readReceipts ?? false,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
