import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  AlufError,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '@aluf/shared';
import { CustomEmojiService } from './custom-emoji.service';

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError) code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof NotFoundError) code = GrpcStatus.NOT_FOUND;
    else if (err instanceof ForbiddenError) code = GrpcStatus.PERMISSION_DENIED;
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

function toEmojiResponse(emoji: { id: string; creatorId: string; mediaId: string; shortcode: string; createdAt: Date; url?: string }) {
  return {
    id: emoji.id,
    creatorId: emoji.creatorId,
    mediaId: emoji.mediaId,
    shortcode: emoji.shortcode,
    createdAt: toGrpcTimestamp(emoji.createdAt),
    url: emoji.url ?? '',
  };
}

@Controller()
export class CustomEmojiController {
  constructor(private readonly customEmojiService: CustomEmojiService) {}

  @GrpcMethod('CustomEmojiService', 'CreateEmoji')
  async createEmoji(data: {
    creator_id?: string;
    creatorId?: string;
    media_id?: string;
    mediaId?: string;
    shortcode?: string;
  }) {
    try {
      const creatorId = (data.creator_id ?? data.creatorId ?? '').trim();
      const mediaId = (data.media_id ?? data.mediaId ?? '').trim();
      const shortcode = (data.shortcode ?? '').trim();
      const emoji = await this.customEmojiService.createEmoji(creatorId, mediaId, shortcode);
      return toEmojiResponse(emoji);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CustomEmojiService', 'ListMyEmoji')
  async listMyEmoji(data: { user_id?: string; userId?: string }) {
    try {
      const userId = (data.user_id ?? data.userId ?? '').trim();
      if (!userId) throw new BadRequestError('user_id обязателен');
      const list = await this.customEmojiService.listMyEmoji(userId);
      return { emoji: list.map(toEmojiResponse) };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CustomEmojiService', 'ListPublicEmoji')
  async listPublicEmoji(data: { search?: string; limit?: number; offset?: number }) {
    try {
      const search = data.search?.trim();
      const limit = data.limit ?? 50;
      const offset = data.offset ?? 0;
      const list = await this.customEmojiService.listPublicEmoji(search, limit, offset);
      return { emoji: list.map(toEmojiResponse) };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CustomEmojiService', 'AddEmojiToMe')
  async addEmojiToMe(data: { user_id?: string; userId?: string; emoji_id?: string; emojiId?: string }) {
    try {
      const userId = (data.user_id ?? data.userId ?? '').trim();
      const emojiId = (data.emoji_id ?? data.emojiId ?? '').trim();
      await this.customEmojiService.addEmojiToMe(userId, emojiId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CustomEmojiService', 'RemoveEmojiFromMe')
  async removeEmojiFromMe(data: { user_id?: string; userId?: string; emoji_id?: string; emojiId?: string }) {
    try {
      const userId = (data.user_id ?? data.userId ?? '').trim();
      const emojiId = (data.emoji_id ?? data.emojiId ?? '').trim();
      await this.customEmojiService.removeEmojiFromMe(userId, emojiId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CustomEmojiService', 'GetEmojiByShortcode')
  async getEmojiByShortcode(data: { shortcode?: string }) {
    try {
      const shortcode = (data.shortcode ?? '').trim();
      const emoji = await this.customEmojiService.getEmojiByShortcode(shortcode);
      if (!emoji) return {};
      return toEmojiResponse(emoji);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CustomEmojiService', 'GetEmojiByIds')
  async getEmojiByIds(data: { ids?: string[] }) {
    try {
      const ids = data.ids ?? [];
      const list = await this.customEmojiService.getEmojiByIds(ids);
      return { emoji: list.map(toEmojiResponse) };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CustomEmojiService', 'DeleteEmoji')
  async deleteEmoji(data: { emoji_id?: string; emojiId?: string; user_id?: string; userId?: string }) {
    try {
      const emojiId = (data.emoji_id ?? data.emojiId ?? '').trim();
      const userId = (data.user_id ?? data.userId ?? '').trim();
      await this.customEmojiService.deleteEmoji(emojiId, userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
