/** Кэш blob по mediaId (IndexedDB), чтобы не тянуть повторно при скролле. */

const DB_NAME = 'aluf-media-cache';
const STORE = 'blobs';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export interface CachedBlobMeta {
  buffer: ArrayBuffer;
  mimeType: string;
  storedAt: number;
}

export async function mediaCacheGet(mediaId: string): Promise<CachedBlobMeta | null> {
  if (typeof indexedDB === 'undefined') return null;
  const id = mediaId.trim();
  if (!id) return null;
  try {
    const db = await openDb();
    return await new Promise<CachedBlobMeta | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const r = store.get(id);
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const v = r.result as CachedBlobMeta | undefined;
        resolve(v && v.buffer && v.mimeType ? v : null);
      };
    });
  } catch {
    return null;
  }
}

export async function mediaCachePut(mediaId: string, blob: Blob): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const id = mediaId.trim();
  if (!id) return;
  try {
    const buffer = await blob.arrayBuffer();
    const mimeType = blob.type || 'application/octet-stream';
    const meta: CachedBlobMeta = { buffer, mimeType, storedAt: Date.now() };
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(meta, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore quota / private mode */
  }
}
