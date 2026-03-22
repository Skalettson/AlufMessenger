import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaService } from '../media.service';

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

const mockMinio = {
  presignedPutObject: vi.fn().mockResolvedValue('https://minio.local/upload?signed=1'),
  presignedGetObject: vi.fn().mockResolvedValue('https://minio.local/file?signed=1'),
  statObject: vi.fn().mockResolvedValue({ size: 1024 }),
  removeObject: vi.fn().mockResolvedValue(undefined),
};

const mockImageProcessor = {
  generateThumbnail: vi.fn().mockResolvedValue('thumb/key.jpg'),
  getImageDimensions: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
  generateBlurhash: vi.fn().mockResolvedValue('LEHV6nWB2yk8pyo0adR*.7kCMdnj'),
};

const sampleUploadSession = {
  id: 'upload-1',
  userId: 'user-1',
  fileName: 'photo.jpg',
  mimeType: 'image/jpeg',
  totalSize: 1024n,
  storageKey: '2025/01/01/abc123.jpg',
  status: 'pending',
  expiresAt: new Date(Date.now() + 7200000),
};

const sampleMediaFile = {
  id: 'file-1',
  uploaderId: 'user-1',
  fileName: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1024n,
  storageKey: '2025/01/01/abc123.jpg',
  thumbnailKey: 'thumb/abc123.jpg',
  metadata: { width: 800, height: 600 },
  createdAt: new Date('2025-01-01'),
};

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();

    service = new MediaService(mockDb as any, mockMinio as any, mockImageProcessor as any);
  });

  describe('initUpload', () => {
    it('should create upload session and return presigned URL', async () => {
      mockDb.limit.mockResolvedValueOnce([{ isPremium: false }]);
      mockDb.returning.mockResolvedValueOnce([sampleUploadSession]);

      const result = await service.initUpload('user-1', 'photo.jpg', 'image/jpeg', 1024n);

      expect(result.uploadId).toBe('upload-1');
      expect(result.uploadUrl).toContain('minio.local');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockMinio.presignedPutObject).toHaveBeenCalled();
    });

    it('should throw when file exceeds size limit for non-premium', async () => {
      mockDb.limit.mockResolvedValueOnce([{ isPremium: false }]);

      await expect(
        service.initUpload('user-1', 'huge.zip', 'application/zip', BigInt(200 * 1024 * 1024)),
      ).rejects.toThrow();
    });

    it('should allow larger files for premium users', async () => {
      mockDb.limit.mockResolvedValueOnce([{ isPremium: true }]);
      mockDb.returning.mockResolvedValueOnce([sampleUploadSession]);

      const result = await service.initUpload(
        'user-1', 'large.zip', 'application/zip', BigInt(150 * 1024 * 1024),
      );

      expect(result.uploadId).toBeDefined();
    });

    it('should throw when upload session creation fails', async () => {
      mockDb.limit.mockResolvedValueOnce([{ isPremium: false }]);
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(
        service.initUpload('user-1', 'photo.jpg', 'image/jpeg', 1024n),
      ).rejects.toThrow('Failed to create upload session');
    });
  });

  describe('completeUpload', () => {
    it('should complete upload for image with thumbnail', async () => {
      mockDb.limit.mockResolvedValueOnce([{ isPremium: false }]); // getUserIsPremium
      mockDb.limit.mockResolvedValueOnce([sampleUploadSession]);
      mockDb.returning.mockResolvedValueOnce([sampleMediaFile]);

      const result = await service.completeUpload('upload-1', 'user-1');

      expect(result.id).toBe('file-1');
      expect(result.fileName).toBe('photo.jpg');
      expect(mockMinio.statObject).toHaveBeenCalled();
      expect(mockImageProcessor.generateThumbnail).toHaveBeenCalled();
    });

    it('should throw when upload session not found', async () => {
      mockDb.limit.mockResolvedValueOnce([{ isPremium: false }]);
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.completeUpload('nonexistent', 'user-1'),
      ).rejects.toThrow('Upload session');
    });

    it('should throw when session already completed', async () => {
      mockDb.limit.mockResolvedValueOnce([{ isPremium: false }]);
      mockDb.limit.mockResolvedValueOnce([{ ...sampleUploadSession, status: 'completed' }]);

      await expect(
        service.completeUpload('upload-1', 'user-1'),
      ).rejects.toThrow('already completed');
    });

    it('should throw when file not in storage', async () => {
      mockDb.limit.mockResolvedValueOnce([{ isPremium: false }]);
      mockDb.limit.mockResolvedValueOnce([sampleUploadSession]);
      mockMinio.statObject.mockRejectedValueOnce(new Error('Not found'));

      await expect(
        service.completeUpload('upload-1', 'user-1'),
      ).rejects.toThrow('File not found in storage');
    });

    it('should handle non-image uploads without thumbnail generation', async () => {
      mockDb.limit.mockResolvedValueOnce([{ isPremium: false }]);
      const audioSession = { ...sampleUploadSession, mimeType: 'audio/mp3' };
      mockDb.limit.mockResolvedValueOnce([audioSession]);
      const audioFile = { ...sampleMediaFile, mimeType: 'audio/mp3', thumbnailKey: null };
      mockDb.returning.mockResolvedValueOnce([audioFile]);

      const result = await service.completeUpload('upload-1', 'user-1');

      expect(result.mimeType).toBe('audio/mp3');
      expect(mockImageProcessor.generateThumbnail).not.toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    it('should return file info when found', async () => {
      mockDb.limit.mockResolvedValueOnce([sampleMediaFile]);

      const result = await service.getFile('file-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('file-1');
    });

    it('should return null when file not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.getFile('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getFileUrl', () => {
    it('should return presigned GET URL', async () => {
      mockDb.limit.mockResolvedValueOnce([sampleMediaFile]);

      const result = await service.getFileUrl('file-1');

      expect(result.url).toContain('minio.local');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockMinio.presignedGetObject).toHaveBeenCalled();
    });

    it('should use thumbnail key for thumbnail variant', async () => {
      mockDb.limit.mockResolvedValueOnce([sampleMediaFile]);

      await service.getFileUrl('file-1', 3600, 'thumbnail');

      expect(mockMinio.presignedGetObject).toHaveBeenCalledWith(
        expect.anything(),
        'thumb/abc123.jpg',
        3600,
      );
    });

    it('should throw when file not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.getFileUrl('nonexistent'),
      ).rejects.toThrow('Media file');
    });
  });

  describe('deleteFile', () => {
    it('should delete file and thumbnail from storage', async () => {
      mockDb.limit.mockResolvedValueOnce([sampleMediaFile]);

      await service.deleteFile('file-1', 'user-1');

      expect(mockMinio.removeObject).toHaveBeenCalledTimes(2);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw when deleting another users file', async () => {
      mockDb.limit.mockResolvedValueOnce([sampleMediaFile]);

      await expect(
        service.deleteFile('file-1', 'other-user'),
      ).rejects.toThrow('only delete your own');
    });

    it('should throw when file not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.deleteFile('nonexistent', 'user-1'),
      ).rejects.toThrow('Media file');
    });
  });
});
