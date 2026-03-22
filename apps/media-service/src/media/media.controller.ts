import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  AlufError,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  FileTooLargeError,
} from '@aluf/shared';
import { MediaService } from './media.service';

const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || 'https://cdn.example.com/aluf-media';

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError || err instanceof FileTooLargeError)
      code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof NotFoundError) code = GrpcStatus.NOT_FOUND;
    else if (err instanceof ForbiddenError) code = GrpcStatus.PERMISSION_DENIED;

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

function structFromObject(obj: Record<string, unknown>): Record<string, unknown> {
  return obj ?? {};
}

@Controller()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @GrpcMethod('MediaService', 'InitUpload')
  async initUpload(data: {
    uploaderId?: string;
    uploader_id?: string;
    fileName?: string;
    file_name?: string;
    mimeType?: string;
    mime_type?: string;
    fileSize?: string | number;
    file_size?: string | number;
  }) {
    try {
      const uploaderId = (data.uploaderId ?? data.uploader_id ?? '').trim();
      if (!uploaderId) {
        throw new BadRequestError('uploaderId is required');
      }
      const fileName = (data.fileName ?? data.file_name ?? 'file').trim() || 'file';
      const mimeType = (data.mimeType ?? data.mime_type ?? 'application/octet-stream').trim() || 'application/octet-stream';
      const rawSize = data.fileSize ?? data.file_size;
      const sizeBytes =
        typeof rawSize === 'string' ? BigInt(rawSize) : BigInt(Number(rawSize) || 0);
      const result = await this.mediaService.initUpload(
        uploaderId,
        fileName,
        mimeType,
        sizeBytes,
      );

      return {
        uploadId: result.uploadId,
        uploadUrl: result.uploadUrl,
        uploadHeaders: { 'Content-Type': mimeType },
        expiresAt: toGrpcTimestamp(result.expiresAt),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MediaService', 'CompleteUpload')
  async completeUpload(data: {
    uploadId?: string;
    upload_id?: string;
    uploaderId?: string;
    uploader_id?: string;
  }) {
    try {
      const uploadId = (data.uploadId ?? data.upload_id ?? '').trim();
      const uploaderId = (data.uploaderId ?? data.uploader_id ?? '').trim();
      if (!uploadId || !uploaderId) {
        throw new BadRequestError('uploadId and uploaderId are required');
      }
      const file = await this.mediaService.completeUpload(
        uploadId,
        uploaderId,
      );

      // Construct URLs directly from storageKey (presigned URLs don't work through nginx)
      const url = `${MINIO_PUBLIC_URL}/${file.storageKey}`;
      const thumbnailUrl = file.thumbnailKey ? `${MINIO_PUBLIC_URL}/${file.thumbnailKey}` : '';
      const width = (file.metadata?.width as number) ?? 0;
      const height = (file.metadata?.height as number) ?? 0;
      const durationSeconds = (file.metadata?.duration as number) ?? 0;

      return {
        id: file.id,
        uploaderId: file.uploaderId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSize: String(file.fileSize),
        mediaType: 0,
        url,
        thumbnailUrl,
        storageKey: file.storageKey,
        thumbnailStorageKey: file.thumbnailKey ?? '',
        width,
        height,
        durationSeconds,
        variants: [],
        metadata: structFromObject(file.metadata),
        createdAt: toGrpcTimestamp(file.createdAt),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MediaService', 'GetFile')
  async getFile(data: { fileId: string }) {
    try {
      const file = await this.mediaService.getFile(data.fileId);
      if (!file) {
        throw new NotFoundError('Media file', data.fileId);
      }

      const width = (file.metadata?.width as number) ?? 0;
      const height = (file.metadata?.height as number) ?? 0;
      const durationSeconds = (file.metadata?.duration as number) ?? 0;

      let url = '';
      let thumbnailUrl = '';
      try {
        const urlRes = await this.mediaService.getFileUrl(file.id, 3600);
        url = urlRes.url;
        if (file.thumbnailKey) {
          const thumbRes = await this.mediaService.getFileUrl(
            file.id,
            3600,
            'thumbnail',
          );
          thumbnailUrl = thumbRes.url;
        }
      } catch {
        // URLs optional
      }

      return {
        id: file.id,
        uploaderId: file.uploaderId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSize: String(file.fileSize),
        mediaType: 0,
        url,
        thumbnailUrl,
        width,
        height,
        durationSeconds,
        variants: [],
        metadata: structFromObject(file.metadata),
        createdAt: toGrpcTimestamp(file.createdAt),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MediaService', 'GetFileUrl')
  async getFileUrl(data: {
    fileId: string;
    variant?: string;
    expiresInSeconds?: number;
  }) {
    try {
      const expiresIn = data.expiresInSeconds ?? 3600;
      const result = await this.mediaService.getFileUrl(
        data.fileId,
        expiresIn,
        data.variant,
      );

      return {
        url: result.url,
        expiresAt: toGrpcTimestamp(result.expiresAt),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MediaService', 'GetFileUrlByStorageKey')
  async getFileUrlByStorageKey(data: {
    storageKey: string;
    expiresInSeconds?: number;
  }) {
    try {
      const expiresIn = data.expiresInSeconds ?? 3600;
      const result = await this.mediaService.getFileUrlByStorageKey(
        data.storageKey,
        expiresIn,
      );

      return {
        url: result.url,
        expiresAt: toGrpcTimestamp(result.expiresAt),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MediaService', 'StreamFile')
  async streamFile(data: {
    fileId: string;
    userId: string;
    variant?: string;
  }) {
    try {
      const result = await this.mediaService.getFileUrl(
        data.fileId,
        3600,
        data.variant,
      );

      return {
        url: result.url,
        expiresAt: toGrpcTimestamp(result.expiresAt),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('MediaService', 'DeleteFile')
  async deleteFile(data: { fileId: string; deleterId: string }) {
    try {
      await this.mediaService.deleteFile(data.fileId, data.deleterId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
