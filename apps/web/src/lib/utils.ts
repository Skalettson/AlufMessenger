import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { ru } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Приводит значение к Date; поддерживает строку, Date и gRPC-таймстамп { seconds, nanos }. Возвращает null при невалидной дате. */
function toValidDate(value: Date | string | { seconds?: number; nanos?: number } | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && 'seconds' in value) {
    const sec = Number((value as { seconds?: number }).seconds) || 0;
    const ns = Number((value as { nanos?: number }).nanos) || 0;
    const d = new Date(sec * 1000 + ns / 1_000_000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatMessageTime(date: Date | string): string {
  const d = toValidDate(date);
  if (!d) return '--:--';
  return format(d, 'HH:mm');
}

export function formatChatDate(date: Date | string): string {
  const d = toValidDate(date);
  if (!d) return 'Сегодня';
  if (isToday(d)) return 'Сегодня';
  if (isYesterday(d)) return 'Вчера';
  if (isThisWeek(d)) return format(d, 'EEEE', { locale: ru });
  return format(d, 'd MMM yyyy', { locale: ru });
}

export function formatLastSeen(date: Date | string | null): string {
  if (date == null) return 'давно';
  const d = toValidDate(date);
  if (!d) return 'давно';
  return formatDistanceToNow(d, { addSuffix: true, locale: ru });
}

/** URL безопасен для использования в src/href (same-origin или blob). Внешние http(s) вызывают OpaqueResponseBlocking. */
export function isSafeMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // blob: URL и относительные пути на frontend безопасны
  // Но пути вида /2026/03/17/abc.png — это storageKey от MinIO, а не frontend пути
  if (url.startsWith('blob:')) return true;
  // Разрешаем только явные frontend пути (не похожие на storageKey MinIO)
  if (url.startsWith('/')) {
    // storageKey обычно выглядит как /YYYY/MM/DD/filename.ext
    // Проверяем, не похож ли это на storageKey
    if (/^\/\d{4}\/\d{2}\/\d{2}\//.test(url)) {
      return false; // Это storageKey, нужно проксировать
    }
    return true; // Другие / пути безопасны
  }
  return false;
}

/** Для внешних URL изображений возвращает same-origin прокси, чтобы аватар/обложка грузились без 403/CORS. */
export function getProxiedImageUrl(
  url: string | null | undefined,
  /** Сброс кэша браузера при смене аватара (updatedAt / timestamp). */
  cacheBust?: string | number | null,
): string | null {
  if (!url?.trim()) return null;
  const stripQueryHash = (v: string) => v.split('#')[0].split('?')[0];

  let out: string | null = null;

  // Already proxied path, but can accidentally contain stale presigned params.
  if (url.startsWith('/aluf-media/')) out = stripQueryHash(url);
  else if (isSafeMediaUrl(url)) out = url;
  // storageKey c ведущим slash: /YYYY/MM/DD/file.ext
  else if (/^\/\d{4}\/\d{2}\/\d{2}\//.test(url)) {
    out = `/aluf-media/${url.replace(/^\/+/, '')}`;
  } else if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      const ownHosts =
        process.env.NEXT_PUBLIC_MEDIA_OWN_HOSTS?.split(',').map((h) => h.trim()).filter(Boolean) ?? [];
      if (ownHosts.length > 0 && ownHosts.includes(parsed.hostname)) {
        out = stripQueryHash(parsed.pathname);
      }
    } catch { /* ignore parse errors */ }
    if (out == null) {
      out = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
  } else if (/^\d{4}\/\d{2}\/\d{2}\//.test(url)) {
    out = `/aluf-media/${url}`;
  } else if (url.startsWith('aluf-media/')) {
    out = `/${url}`;
  }

  if (!out) return null;
  if (cacheBust != null && String(cacheBust) !== '') {
    const sep = out.includes('?') ? '&' : '?';
    return `${out}${sep}v=${encodeURIComponent(String(cacheBust))}`;
  }
  return out;
}

/** Предпочитает прокси-URL при наличии mediaId; иначе url только если он safe (blob или /). */
export function pickMediaUrl(proxiedUrl: string | null, rawUrl: string | null | undefined, hasMediaId: boolean): string | null {
  if (hasMediaId && proxiedUrl) return proxiedUrl;
  if (rawUrl && isSafeMediaUrl(rawUrl)) return rawUrl;
  return proxiedUrl ?? null;
}

/** Сторис: видео по Content-Type или по расширению URL (blob / прямой путь). */
export function isStoryVideoMedia(mimeType: string | null | undefined, url: string | null | undefined): boolean {
  const m = mimeType?.split(';')[0]?.trim().toLowerCase();
  if (m?.startsWith('video/')) return true;
  if (m?.startsWith('image/')) return false;
  const path = (url ?? '').split(/[#]/)[0]?.toLowerCase() ?? '';
  return /\.(mp4|mpe?g|webm|mov|m4v|ogg|ogv)(\?.*)?$/i.test(path);
}

/** Формат длительности медиа: "M:SS" (например 1:23). */
export function formatMediaDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Разворачивает google.protobuf.Struct из gRPC в плоский объект.
 * Уже плоские JSON-объекты (jsonb из API) возвращает как есть.
 */
export function unwrapGrpcStructMetadata(meta: unknown): Record<string, unknown> | null {
  if (meta == null) return null;
  if (typeof meta !== 'object' || Array.isArray(meta)) return null;
  const o = meta as Record<string, unknown>;
  if (o.fields && typeof o.fields === 'object' && !Array.isArray(o.fields)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o.fields as Record<string, unknown>)) {
      const val = v as Record<string, unknown>;
      if (val && typeof val === 'object') {
        if ('numberValue' in val) out[k] = val.numberValue;
        else if ('stringValue' in val) out[k] = val.stringValue;
        else if ('boolValue' in val) out[k] = val.boolValue;
      }
    }
    return out;
  }
  return o;
}
