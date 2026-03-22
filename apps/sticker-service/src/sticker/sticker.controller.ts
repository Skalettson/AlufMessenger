import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  AlufError,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '@aluf/shared';
import { StickerService } from './sticker.service';

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

function toPackResponse(pack: {
  id: string;
  name: string;
  isPremium: boolean;
  creatorId: string | null;
  isPublic: boolean;
  coverMediaId: string | null;
  description: string | null;
  createdAt: Date;
  isMine?: boolean;
  addedToMe?: boolean;
  previewMediaId?: string | null;
}) {
  const preview = String(pack.previewMediaId ?? pack.coverMediaId ?? '').trim();
  return {
    id: pack.id,
    name: pack.name,
    isPremium: pack.isPremium,
    creatorId: pack.creatorId ?? '',
    isPublic: pack.isPublic,
    coverMediaId: pack.coverMediaId ?? '',
    previewMediaId: preview,
    description: pack.description ?? '',
    createdAt: toGrpcTimestamp(pack.createdAt),
    isMine: pack.isMine ?? false,
    addedToMe: pack.addedToMe ?? false,
  };
}

@Controller()
export class StickerController {
  constructor(private readonly stickerService: StickerService) {}

  @GrpcMethod('StickerService', 'CreatePack')
  async createPack(data: {
    creator_id?: string;
    creatorId?: string;
    name?: string;
    is_public?: boolean;
    isPublic?: boolean;
    description?: string;
  }) {
    try {
      const creatorId = (data.creator_id ?? data.creatorId ?? '').trim();
      const name = (data.name ?? '').trim();
      const isPublic = data.is_public ?? data.isPublic ?? true;
      const pack = await this.stickerService.createPack(
        creatorId,
        name,
        isPublic,
        data.description,
      );
      return toPackResponse({ ...pack, isMine: true, addedToMe: true });
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StickerService', 'AddStickerToPack')
  async addStickerToPack(data: {
    pack_id?: string;
    packId?: string;
    media_id?: string;
    mediaId?: string;
    user_id?: string;
    userId?: string;
  }) {
    try {
      const packId = (data.pack_id ?? data.packId ?? '').trim();
      const mediaId = (data.media_id ?? data.mediaId ?? '').trim();
      const userId = (data.user_id ?? data.userId ?? '').trim();
      await this.stickerService.addStickerToPack(packId, mediaId, userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StickerService', 'ListMyPacks')
  async listMyPacks(data: { user_id?: string; userId?: string }) {
    try {
      const userId = (data.user_id ?? data.userId ?? '').trim();
      if (!userId) throw new BadRequestError('user_id обязателен');
      const packs = await this.stickerService.listMyPacks(userId);
      return {
        packs: packs.map((p) => toPackResponse(p)),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StickerService', 'ListPublicPacks')
  async listPublicPacks(data: {
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      const search = data.search?.trim();
      const limit = data.limit ?? 50;
      const offset = data.offset ?? 0;
      const packs = await this.stickerService.listPublicPacks(search, limit, offset);
      return {
        packs: packs.map((p) => toPackResponse(p)),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StickerService', 'AddPackToMe')
  async addPackToMe(data: {
    user_id?: string;
    userId?: string;
    pack_id?: string;
    packId?: string;
  }) {
    try {
      const userId = (data.user_id ?? data.userId ?? '').trim();
      const packId = (data.pack_id ?? data.packId ?? '').trim();
      await this.stickerService.addPackToMe(userId, packId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StickerService', 'RemovePackFromMe')
  async removePackFromMe(data: {
    user_id?: string;
    userId?: string;
    pack_id?: string;
    packId?: string;
  }) {
    try {
      const userId = (data.user_id ?? data.userId ?? '').trim();
      const packId = (data.pack_id ?? data.packId ?? '').trim();
      await this.stickerService.removePackFromMe(userId, packId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StickerService', 'GetPackWithStickers')
  async getPackWithStickers(data: { pack_id?: string; packId?: string }) {
    try {
      const packId = (data.pack_id ?? data.packId ?? '').trim();
      const { pack, stickers } = await this.stickerService.getPackWithStickers(packId);
      const firstStickerId = stickers[0]?.mediaId ?? '';
      return {
        pack: toPackResponse({
          ...pack,
          previewMediaId: pack.coverMediaId ?? (firstStickerId || null),
        }),
        stickers: stickers.map((s) => ({
          mediaId: s.mediaId,
          fileName: s.fileName,
          mimeType: s.mimeType,
        })),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StickerService', 'GetPackByStickerMediaId')
  async getPackByStickerMediaId(data: { media_id?: string; mediaId?: string; user_id?: string; userId?: string }) {
    try {
      const mediaId = (data.media_id ?? data.mediaId ?? '').trim();
      const userId = (data.user_id ?? data.userId ?? '').trim();
      const pack = await this.stickerService.getPackByStickerMediaId(mediaId, userId);
      return toPackResponse(pack);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StickerService', 'DeletePack')
  async deletePack(data: {
    pack_id?: string;
    packId?: string;
    user_id?: string;
    userId?: string;
  }) {
    try {
      const packId = (data.pack_id ?? data.packId ?? '').trim();
      const userId = (data.user_id ?? data.userId ?? '').trim();
      await this.stickerService.deletePack(packId, userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StickerService', 'RemoveStickerFromPack')
  async removeStickerFromPack(data: {
    pack_id?: string;
    packId?: string;
    media_id?: string;
    mediaId?: string;
    user_id?: string;
    userId?: string;
  }) {
    try {
      const packId = (data.pack_id ?? data.packId ?? '').trim();
      const mediaId = (data.media_id ?? data.mediaId ?? '').trim();
      const userId = (data.user_id ?? data.userId ?? '').trim();
      await this.stickerService.removeStickerFromPack(packId, mediaId, userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
