import { Injectable, Inject } from '@nestjs/common';
import type * as Minio from 'minio';
import sharp from 'sharp';
import { MINIO_TOKEN } from '../providers/minio.provider';
import { SUPPORTED_IMAGE_TYPES, THUMBNAIL_SIZE } from '@aluf/shared';

const BUCKET = process.env.MINIO_BUCKET || 'aluf-media';

@Injectable()
export class ImageProcessor {
  constructor(
    @Inject(MINIO_TOKEN)
    private readonly minio: Minio.Client,
  ) {}

  async generateThumbnail(
    storageKey: string,
    bucket: string = BUCKET,
  ): Promise<string> {
    const stream = await this.minio.getObject(bucket, storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const thumbnailKey = storageKey.replace(/(\.[^.]+)$/, '.thumb$1');
    const resized = await sharp(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    await this.minio.putObject(bucket, thumbnailKey, resized, resized.length, {
      'Content-Type': 'image/jpeg',
    });

    return thumbnailKey;
  }

  async getImageDimensions(
    storageKey: string,
    bucket: string = BUCKET,
  ): Promise<{ width: number; height: number }> {
    const stream = await this.minio.getObject(bucket, storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
    };
  }

  async compressImage(
    storageKey: string,
    bucket: string = BUCKET,
    quality: number = 85,
  ): Promise<Buffer> {
    const stream = await this.minio.getObject(bucket, storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    return sharp(buffer)
      .jpeg({ quality })
      .toBuffer();
  }

  async generateBlurhash(
    storageKey: string,
    bucket: string = BUCKET,
  ): Promise<string> {
    try {
      const blurhash = await import('blurhash');
      const stream = await this.minio.getObject(bucket, storageKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      const { data, info } = await sharp(buffer)
        .raw()
        .ensureAlpha()
        .resize(32, 32, { fit: 'inside' })
        .toBuffer({ resolveWithObject: true });

      const w = info.width ?? 32;
      const h = info.height ?? 32;
      if (w < 1 || h < 1) {
        return `placeholder:${w}x${h}`;
      }
      const pixels = new Uint8ClampedArray(data);
      const hash = blurhash.encode(pixels, w, h, 4, 4);
      return hash;
    } catch {
      const dims = await this.getImageDimensions(storageKey, bucket);
      return `placeholder:${dims.width}x${dims.height}`;
    }
  }

  isSupportedImageType(mimeType: string): boolean {
    return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType);
  }
}
