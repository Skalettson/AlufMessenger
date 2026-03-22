import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type * as Minio from 'minio';
import {
  mediaFiles,
  uploadSessions,
  users,
} from '@aluf/db';
import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_PREMIUM,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
  SUPPORTED_AUDIO_TYPES,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  FileTooLargeError,
} from '@aluf/shared';
import { DATABASE_TOKEN } from '../providers/database.provider';
import { MINIO_TOKEN } from '../providers/minio.provider';
import { ImageProcessor } from './image-processor';

const BUCKET = process.env.MINIO_BUCKET || 'aluf-media';
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || 'https://cdn.example.com/aluf-media';
const PRESIGNED_PUT_EXPIRY_SEC = 2 * 60 * 60;
const PRESIGNED_GET_EXPIRY_SEC = 60 * 60;

interface CompleteUploadTask {
  uploadId: string;
  userId: string;
  resolve: (value: MediaFileInfo) => void;
  reject: (err: Error) => void;
}

export interface MediaFileInfo {
  id: string;
  uploaderId: string;
  fileName: string;
  mimeType: string;
  fileSize: bigint;
  storageKey: string;
  thumbnailKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

@Injectable()
export class MediaService {
  private readonly premiumQueue: CompleteUploadTask[] = [];
  private readonly freeQueue: CompleteUploadTask[] = [];
  private processing = false;

  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: import('@aluf/db').Database,
    @Inject(MINIO_TOKEN)
    private readonly minio: Minio.Client,
    private readonly imageProcessor: ImageProcessor,
  ) {}

  async initUpload(
    userId: string,
    fileName: string,
    mimeType: string,
    sizeBytes: bigint,
  ): Promise<{ uploadId: string; uploadUrl: string; expiresAt: Date }> {
    const uid = (userId ?? '').trim();
    if (!uid) {
      throw new BadRequestError('uploaderId is required');
    }
    const sizeNum = Number(sizeBytes);
    const isPremium = await this.getUserIsPremium(uid);
    const maxSize = isPremium ? Number(MAX_FILE_SIZE_PREMIUM) : Number(MAX_FILE_SIZE);
    if (sizeNum > maxSize) {
      throw new FileTooLargeError(maxSize);
    }

    const ext = this.getExtensionFromFileName(fileName);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const { nanoid } = await import('nanoid');
    const storageKey = `${year}/${month}/${day}/${nanoid()}${ext}`;

    const expiresAt = new Date(Date.now() + PRESIGNED_PUT_EXPIRY_SEC * 1000);
    
    // Generate presigned URL from MinIO with correct path
    const minioUrl = await this.minio.presignedPutObject(
      BUCKET,
      storageKey,
      PRESIGNED_PUT_EXPIRY_SEC,
    );
    
    // Convert internal MinIO URL to public URL (MINIO_PUBLIC_URL must match your deployment).
    const urlParts = minioUrl.split('?');
    const pathPart = urlParts[0]; // http://minio:9000/aluf-media/2026/03/20/abc.jpg
    const queryPart = urlParts[1]; // X-Amz-...
    
    // Extract just the path after bucket
    const pathMatch = pathPart.match(/\/aluf-media\/(.+)$/);
    if (!pathMatch) {
      throw new Error('Invalid MinIO URL format');
    }
    
    const relativePath = pathMatch[1]; // 2026/03/20/abc.jpg
    const uploadUrl = `${MINIO_PUBLIC_URL}/${relativePath}?${queryPart}`;

    const [session] = await this.db
      .insert(uploadSessions)
      .values({
        userId: uid,
        fileName,
        mimeType,
        totalSize: sizeBytes,
        storageKey,
        status: 'pending',
        expiresAt,
      })
      .returning();

    if (!session) {
      throw new BadRequestError('Failed to create upload session');
    }

    return {
      uploadId: session.id,
      uploadUrl,
      expiresAt,
    };
  }

  async completeUpload(
    uploadId: string,
    userId: string,
  ): Promise<MediaFileInfo> {
    const isPremium = await this.getUserIsPremium(userId);
    return new Promise<MediaFileInfo>((resolve, reject) => {
      const task: CompleteUploadTask = { uploadId, userId, resolve, reject };
      if (isPremium) {
        this.premiumQueue.push(task);
      } else {
        this.freeQueue.push(task);
      }
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.processing) return;
    const task = this.premiumQueue.shift() ?? this.freeQueue.shift();
    if (!task) return;

    this.processing = true;
    this.doCompleteUpload(task.uploadId, task.userId)
      .then((result) => {
        task.resolve(result);
      })
      .catch((err) => {
        task.reject(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        this.processing = false;
        if (this.premiumQueue.length > 0 || this.freeQueue.length > 0) {
          setImmediate(() => this.processNext());
        }
      });
  }

  private async doCompleteUpload(
    uploadId: string,
    userId: string,
  ): Promise<MediaFileInfo> {
    const [session] = await this.db
      .select()
      .from(uploadSessions)
      .where(
        and(
          eq(uploadSessions.id, uploadId),
          eq(uploadSessions.userId, userId),
        ),
      )
      .limit(1);

    if (!session) {
      throw new NotFoundError('Upload session', uploadId);
    }

    if (session.status !== 'pending') {
      throw new BadRequestError('Upload session already completed or expired');
    }

    try {
      await this.minio.statObject(BUCKET, session.storageKey);
    } catch {
      throw new BadRequestError('File not found in storage. Upload may have failed.');
    }

    let thumbnailKey: string | null = null;
    const metadata: Record<string, unknown> = {};

    const isImage =
      (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(session.mimeType);
    const isVideo =
      (SUPPORTED_VIDEO_TYPES as readonly string[]).includes(session.mimeType);
    const isAudio =
      (SUPPORTED_AUDIO_TYPES as readonly string[]).includes(session.mimeType);

    if (isImage) {
      thumbnailKey = await this.imageProcessor.generateThumbnail(
        session.storageKey,
        BUCKET,
      );
      const dims = await this.imageProcessor.getImageDimensions(
        session.storageKey,
        BUCKET,
      );
      metadata.width = dims.width;
      metadata.height = dims.height;
      try {
        metadata.blurhash = await this.imageProcessor.generateBlurhash(
          session.storageKey,
          BUCKET,
        );
      } catch {
        metadata.blurhash = `placeholder:${dims.width}x${dims.height}`;
      }
    } else if (isVideo) {
      // Placeholder: video thumbnail extraction would use ffmpeg in a worker
    } else if (isAudio) {
      // Placeholder: duration extraction would use ffprobe
    }

    const [file] = await this.db
      .insert(mediaFiles)
      .values({
        uploaderId: userId,
        fileName: session.fileName,
        mimeType: session.mimeType,
        sizeBytes: session.totalSize,
        storageKey: session.storageKey,
        thumbnailKey,
        metadata,
      })
      .returning();

    if (!file) {
      throw new BadRequestError('Failed to create media file record');
    }

    await this.db
      .update(uploadSessions)
      .set({ status: 'completed' })
      .where(eq(uploadSessions.id, uploadId));

    return {
      id: file.id,
      uploaderId: file.uploaderId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.sizeBytes,
      storageKey: file.storageKey,
      thumbnailKey: file.thumbnailKey,
      metadata: (file.metadata as Record<string, unknown>) ?? {},
      createdAt: file.createdAt,
    };
  }

  async getFile(fileId: string): Promise<MediaFileInfo | null> {
    const [file] = await this.db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, fileId))
      .limit(1);

    if (!file) return null;

    return {
      id: file.id,
      uploaderId: file.uploaderId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.sizeBytes,
      storageKey: file.storageKey,
      thumbnailKey: file.thumbnailKey,
      metadata: (file.metadata as Record<string, unknown>) ?? {},
      createdAt: file.createdAt,
    };
  }

  async getFileUrl(
    fileId: string,
    expiresInSeconds: number = PRESIGNED_GET_EXPIRY_SEC,
    variant?: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new NotFoundError('Media file', fileId);
    }

    let key = file.storageKey;
    if (variant === 'thumbnail' && file.thumbnailKey) {
      key = file.thumbnailKey;
    }

    const url = await this.minio.presignedGetObject(
      BUCKET,
      key,
      expiresInSeconds,
    );
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return { url, expiresAt };
  }

  /**
   * Генерирует presigned URL напрямую по storageKey (без поиска по fileId).
   * Используется для генерации URL аватаров и обложек "на лету".
   */
  async getFileUrlByStorageKey(
    storageKey: string,
    expiresInSeconds: number = PRESIGNED_GET_EXPIRY_SEC,
  ): Promise<{ url: string; expiresAt: Date }> {
    const url = await this.minio.presignedGetObject(
      BUCKET,
      storageKey,
      expiresInSeconds,
    );
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return { url, expiresAt };
  }

  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new NotFoundError('Media file', fileId);
    }

    if (file.uploaderId !== userId) {
      throw new ForbiddenError('You can only delete your own files');
    }

    try {
      await this.minio.removeObject(BUCKET, file.storageKey);
    } catch (err) {
      // Log but continue - object may already be deleted
    }

    if (file.thumbnailKey) {
      try {
        await this.minio.removeObject(BUCKET, file.thumbnailKey);
      } catch {
        // Ignore thumbnail delete errors
      }
    }

    await this.db.delete(mediaFiles).where(eq(mediaFiles.id, fileId));
  }

  private async getUserIsPremium(userId: string): Promise<boolean> {
    const [user] = await this.db
      .select({ isPremium: users.isPremium })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user?.isPremium ?? false;
  }

  private getExtensionFromFileName(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1 || lastDot === fileName.length - 1) {
      return '';
    }
    const ext = fileName.slice(lastDot).toLowerCase();
    if (ext.length > 10) return '';
    return ext;
  }
}
