import { api, loadTokens, getAccessToken } from './api';

interface UploadSession {
  id: string;
  uploadUrl: string;
}

interface MediaFile {
  id: string;
  url: string;
  storageKey: string;
  thumbnailUrl?: string;
  thumbnailStorageKey?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  metadata?: { width?: number; height?: number; duration?: number };
}

export type UploadFileController = {
  abort: () => void;
  promise: Promise<MediaFile>;
};

/** Загрузка с возможностью отмены (XHR.abort). */
export function uploadFileWithAbort(
  file: File,
  chatId?: string,
  onProgress?: (percent: number) => void,
): UploadFileController {
  loadTokens();
  if (!getAccessToken()) {
    return {
      abort: () => {},
      promise: Promise.reject(new Error('Войдите в аккаунт для загрузки файлов')),
    };
  }

  const xhrRef = { current: null as XMLHttpRequest | null };
  const promise = (async () => {
    const session = await api.post<UploadSession>('/media/upload', {
      fileName: file.name || 'file',
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      chatId,
    });

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('PUT', session.uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);
      try {
        if (typeof session.uploadUrl === 'string' && typeof window !== 'undefined') {
          const uploadUrlObj = new URL(session.uploadUrl, window.location.origin);
          const isOurApi =
            uploadUrlObj.origin === window.location.origin && uploadUrlObj.pathname.startsWith('/api/');
          const token = getAccessToken();
          if (isOurApi && token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
        }
      } catch {
        /* ignore */
      }
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.onabort = () => reject(new Error('Загрузка отменена'));
      xhr.send(file);
    });

    loadTokens();
    const raw = await api.post<
      MediaFile & {
        url?: string;
        file_id?: string;
        media_id?: string;
        storage_key?: string;
        thumbnail_storage_key?: string;
      }
    >(`/media/upload/${session.id}/complete`);
    const id = (
      raw?.id ??
      (raw as { id?: string })?.id ??
      (raw as { file_id?: string })?.file_id ??
      (raw as { media_id?: string })?.media_id ??
      ''
    ).trim();
    const url = raw?.url ?? (raw as { url?: string })?.url ?? '';
    const storageKey = raw?.storageKey ?? (raw as { storage_key?: string })?.storage_key ?? '';
    const thumbnailUrl = raw?.thumbnailUrl ?? (raw as { thumbnail_url?: string })?.thumbnail_url;
    const thumbnailStorageKey =
      raw?.thumbnailStorageKey ?? (raw as { thumbnail_storage_key?: string })?.thumbnail_storage_key;
    const sizeBytes =
      typeof (raw as MediaFile).sizeBytes === 'number'
        ? (raw as MediaFile).sizeBytes
        : Number((raw as { file_size?: string })?.file_size ?? 0);
    return {
      id,
      url,
      storageKey,
      thumbnailUrl,
      thumbnailStorageKey,
      fileName: raw?.fileName ?? (raw as { file_name?: string })?.file_name ?? file.name,
      mimeType: raw?.mimeType ?? (raw as { mime_type?: string })?.mime_type ?? file.type,
      sizeBytes: sizeBytes || file.size,
      metadata: (raw as MediaFile).metadata,
    };
  })();

  return {
    abort: () => xhrRef.current?.abort(),
    promise,
  };
}

export async function uploadFile(
  file: File,
  chatId?: string,
  onProgress?: (percent: number) => void,
): Promise<MediaFile> {
  return uploadFileWithAbort(file, chatId, onProgress).promise;
}
