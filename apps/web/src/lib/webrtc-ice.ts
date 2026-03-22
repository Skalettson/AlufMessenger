/**
 * ICE-серверы для WebRTC (STUN + опционально TURN/Coturn).
 * Список загружается с /api/webrtc/ice (учётные данные TURN не вшиваются в бандл).
 */

const DEFAULT_STUN: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

let cache: RTCIceServer[] | null = null;
let inflight: Promise<RTCIceServer[]> | null = null;

function normalizeServers(data: unknown): RTCIceServer[] | null {
  if (!data || typeof data !== 'object' || !('iceServers' in data)) return null;
  const raw = (data as { iceServers: unknown }).iceServers;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: RTCIceServer[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const urls = (entry as RTCIceServer).urls;
    if (urls == null) continue;
    const o: RTCIceServer = { urls };
    const u = (entry as RTCIceServer).username;
    const c = (entry as RTCIceServer).credential;
    if (typeof u === 'string' && u) o.username = u;
    if (typeof c === 'string' && c) o.credential = c;
    out.push(o);
  }
  return out.length ? out : null;
}

/** Сброс кэша (например после смены сети) — опционально. */
export function clearIceServersCache() {
  cache = null;
  inflight = null;
}

/**
 * Возвращает ICE-серверы (один запрос на сессию страницы).
 * При ошибке API — только публичные STUN.
 */
export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch('/api/webrtc/ice', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (res.ok) {
          const json: unknown = await res.json();
          const parsed = normalizeServers(json);
          if (parsed) {
            cache = parsed;
            return cache;
          }
        }
      } catch {
        /* сеть / SSR */
      }
      cache = DEFAULT_STUN;
      return cache;
    })();
  }
  return inflight;
}
