export type MediaType = 'image' | 'video' | 'audio' | 'voice' | 'video_note' | 'document' | 'sticker' | 'gif';

export interface MediaFile {
  id: string;
  uploaderId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  thumbnailKey: string | null;
  metadata: MediaMetadata;
  createdAt: Date;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  waveform?: number[];
  codec?: string;
  bitrate?: number;
  hasAudio?: boolean;
  blurhash?: string;
}

export interface UploadSession {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  totalSize: number;
  uploadedSize: number;
  storageKey: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  expiresAt: Date;
  createdAt: Date;
}

export interface MediaUploadRequest {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: MediaType;
}

export interface MediaUploadResponse {
  uploadId: string;
  uploadUrl: string;
  expiresAt: Date;
}
