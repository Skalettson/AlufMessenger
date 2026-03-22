const API_BASE = '/api/v1';

/** Session storage version; bump to invalidate all existing client sessions. */
const SESSION_STORAGE_VERSION = 1;
const STORAGE_KEYS = {
  ACCESS: 'aluf_access_token',
  REFRESH: 'aluf_refresh_token',
  VERSION: 'aluf_session_version',
} as const;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<void> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** Persist tokens and set in-memory cache. Single writer for session state. */
export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (isBrowser()) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS, access);
      localStorage.setItem(STORAGE_KEYS.REFRESH, refresh);
      localStorage.setItem(STORAGE_KEYS.VERSION, String(SESSION_STORAGE_VERSION));
    } catch {
      // quota or privacy mode
    }
  }
}

/** Load from localStorage into memory. Call at app init and before each API request. */
export function loadTokens(): void {
  if (!isBrowser()) return;
  try {
    let version = localStorage.getItem(STORAGE_KEYS.VERSION);
    let access = localStorage.getItem(STORAGE_KEYS.ACCESS);
    let refresh = localStorage.getItem(STORAGE_KEYS.REFRESH);

    if (!access) {
      const legacyAccess = localStorage.getItem('access_token');
      const legacyRefresh = localStorage.getItem('refresh_token');
      if (legacyAccess && legacyRefresh) {
        localStorage.setItem(STORAGE_KEYS.ACCESS, legacyAccess);
        localStorage.setItem(STORAGE_KEYS.REFRESH, legacyRefresh);
        localStorage.setItem(STORAGE_KEYS.VERSION, String(SESSION_STORAGE_VERSION));
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        access = legacyAccess;
        refresh = legacyRefresh;
      } else {
        clearTokens();
        return;
      }
    }
    // Сбрасываем сессию только если VERSION явно записан и не совпадает (смена формата).
    // Если VERSION отсутствует при наличии access — не сбрасываем, дописываем VERSION.
    if (version != null && version !== String(SESSION_STORAGE_VERSION)) {
      clearTokens();
      return;
    }
    if (access && !version) {
      try {
        localStorage.setItem(STORAGE_KEYS.VERSION, String(SESSION_STORAGE_VERSION));
      } catch {
        // quota
      }
    }

    accessToken = access;
    refreshToken = refresh;
  } catch {
    accessToken = null;
    refreshToken = null;
  }
}

/** Clear session and force re-login. Removes current and legacy keys. */
export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  refreshPromise = null;
  if (isBrowser()) {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS);
      localStorage.removeItem(STORAGE_KEYS.REFRESH);
      localStorage.removeItem(STORAGE_KEYS.VERSION);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } catch {}
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refreshAccessToken(): Promise<void> {
  if (!refreshToken) throw new Error('No refresh token');
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    if (isBrowser()) window.location.href = '/auth';
    throw new Error('Token refresh failed');
  }
  const data = await res.json().catch(() => ({}));
  const access = data?.accessToken ?? data?.access_token;
  const refresh = data?.refreshToken ?? data?.refresh_token;
  if (typeof access === 'string' && typeof refresh === 'string') {
    setTokens(access, refresh);
  } else {
    throw new Error('Неверный ответ при обновлении сессии');
  }
}

/** Redirect to login and clear session (e.g. on 401). */
function requireReLogin(): void {
  clearTokens();
  if (isBrowser()) window.location.href = '/auth';
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  loadTokens();
  // Fallback: use token from localStorage if in-memory was not set (e.g. first request after load)
  if (isBrowser() && !accessToken) {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACCESS);
      if (stored) {
        accessToken = stored;
      }
    } catch {}
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    ...(options.headers as Record<string, string> || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
    headers['X-Access-Token'] = accessToken;
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && refreshToken) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    try {
      await refreshPromise;
    } catch {
      requireReLogin();
      throw new ApiError(401, 'Сессия истекла. Войдите снова.');
    }
    headers['Authorization'] = `Bearer ${accessToken}`;
    if (accessToken) headers['X-Access-Token'] = accessToken;
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  }

  if (res.status === 401) {
    requireReLogin();
    const text401 = await res.clone().text();
    let parsed401: unknown = {};
    if (text401) {
      try {
        parsed401 = JSON.parse(text401) as unknown;
      } catch {
        parsed401 = { message: text401.slice(0, 200) };
      }
    }
    const message = getErrorMessage(parsed401, 'Сессия истекла. Войдите снова.');
    throw new ApiError(401, message);
  }

  if (!res.ok) {
    const text = await res.text();
    let parsed: unknown = {};
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = { message: text.slice(0, 500) };
      }
    }
    const message = getErrorMessage(parsed, res.statusText || 'Ошибка запроса');
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Извлекает строку сообщения из ответа API (error: { message?, details? } или message) */
export function getErrorMessage(value: unknown, fallback = 'Произошла ошибка'): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || fallback;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const err = obj.error;
    if (err && typeof err === 'object' && err !== null) {
      const errObj = err as Record<string, unknown>;
      const details = errObj.details;
      if (details && typeof details === 'object' && details !== null) {
        const firstEntry = Object.values(details)[0];
        if (Array.isArray(firstEntry) && firstEntry[0] && typeof firstEntry[0] === 'string') {
          return firstEntry[0];
        }
      }
      if (typeof details === 'string' && details) return details;
      const msg = errObj.message;
      if (typeof msg === 'string' && msg) return msg;
    }
    const msg = obj.message;
    if (typeof msg === 'string' && msg) return msg;
    if (obj.details && typeof obj.details === 'object') {
      const details = obj.details as Record<string, unknown>;
      const first = Object.values(details)[0];
      if (Array.isArray(first) && first[0] && typeof first[0] === 'string') return first[0];
    }
  }
  return fallback;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path),
  post: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
