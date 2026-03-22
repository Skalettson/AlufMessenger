'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Monitor, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { UserAvatar } from '@/components/shared/user-avatar';

interface UserDetail {
  id: string;
  username: string;
  display_name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  bio?: string;
  avatar_url?: string;
  avatarUrl?: string;
  created_at?: string;
  createdAt?: string;
  last_seen_at?: string | null;
  lastSeenAt?: string | null;
  is_online?: boolean;
  isOnline?: boolean;
  is_premium?: boolean;
  isPremium?: boolean;
  is_verified?: boolean;
  isVerified?: boolean;
  is_official?: boolean;
  isOfficial?: boolean;
}

interface DeviceInfo {
  device_name?: string;
  deviceName?: string;
  platform?: string;
}

interface SessionRow {
  id: string;
  device_info?: DeviceInfo;
  deviceInfo?: DeviceInfo;
  ip?: string;
  created_at?: string;
  createdAt?: string;
  last_active_at?: string;
  lastActiveAt?: string;
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUser = async () => {
    try {
      const res = await api.get<UserDetail>(`/admin/users/${id}`);
      setUser(res);
    } catch {
      setError('Не удалось загрузить пользователя');
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await api.get<{ sessions: SessionRow[] }>(`/admin/users/${id}/sessions`);
      setSessions(Array.isArray(res.sessions) ? res.sessions : []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      await loadUser();
      if (!cancelled) await loadSessions();
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleTerminateSession = async (sessionId: string) => {
    if (!confirm('Завершить эту сессию? Пользователь будет разлогинен с этого устройства.')) return;
    setTerminatingId(sessionId);
    try {
      await api.post(`/admin/sessions/${sessionId}/terminate`, {});
      await loadSessions();
    } catch {
      alert('Не удалось завершить сессию');
    } finally {
      setTerminatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> К списку пользователей
        </Link>
        <p className="text-destructive">{error ?? 'Пользователь не найден'}</p>
      </div>
    );
  }

  const displayName = user.displayName ?? user.display_name ?? user.username;
  const avatarUrl = user.avatarUrl ?? user.avatar_url;
  const createdAt = user.createdAt ?? user.created_at;
  const lastSeen = user.lastSeenAt ?? user.last_seen_at;
  const isOnline = user.isOnline ?? user.is_online;

  const sessionDevice = (s: SessionRow) => {
    const info = s.deviceInfo ?? s.device_info;
    if (!info) return '—';
    const name = info.deviceName ?? info.device_name;
    const platform = info.platform;
    return [name, platform].filter(Boolean).join(' · ') || 'Устройство';
  };
  const sessionCreated = (s: SessionRow) => s.createdAt ?? s.created_at ?? '';
  const sessionLastActive = (s: SessionRow) => s.lastActiveAt ?? s.last_active_at ?? '';

  return (
    <div className="space-y-8">
      <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> К списку пользователей
      </Link>

      {/* Профиль */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <UserAvatar src={avatarUrl} name={displayName} size="lg" className="h-20 w-20 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h1 className="text-xl font-bold">{displayName}</h1>
              <p className="text-muted-foreground">@{user.username}</p>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{user.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Телефон</dt>
                <dd>{user.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Регистрация</dt>
                <dd>{createdAt ? new Date(createdAt).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Активность</dt>
                <dd>
                  {isOnline ? <span className="text-green-600">В сети</span> : lastSeen ? new Date(lastSeen as string).toLocaleString() : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Premium</dt>
                <dd>{user.isPremium ?? user.is_premium ? 'Да' : 'Нет'}</dd>
              </div>
            </dl>
            {user.bio && (
              <div>
                <dt className="text-muted-foreground text-sm">О себе</dt>
                <dd className="mt-1 text-sm">{user.bio}</dd>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Верификация */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h2 className="font-semibold">Статус аккаунта</h2>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Подтверждённый аккаунт</p>
              <p className="text-xs text-muted-foreground">Синяя галочка в профиле</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={user.isVerified ?? user.is_verified ?? false}
              onClick={async () => {
                const newVal = !(user.isVerified ?? user.is_verified ?? false);
                try {
                  await api.patch(`/admin/users/${id}`, { isVerified: newVal });
                  setUser((prev) => prev ? { ...prev, isVerified: newVal, is_verified: newVal } : prev);
                } catch { alert('Ошибка при обновлении'); }
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                (user.isVerified ?? user.is_verified) ? 'bg-blue-500' : 'bg-muted'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                (user.isVerified ?? user.is_verified) ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </label>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Официальный аккаунт</p>
              <p className="text-xs text-muted-foreground">Золотой бейдж везде (чаты, сообщения, профиль)</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={user.isOfficial ?? user.is_official ?? false}
              onClick={async () => {
                const newVal = !(user.isOfficial ?? user.is_official ?? false);
                try {
                  await api.patch(`/admin/users/${id}`, { isOfficial: newVal });
                  setUser((prev) => prev ? { ...prev, isOfficial: newVal, is_official: newVal } : prev);
                } catch { alert('Ошибка при обновлении'); }
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                (user.isOfficial ?? user.is_official) ? 'bg-amber-500' : 'bg-muted'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                (user.isOfficial ?? user.is_official) ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </label>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Premium</p>
              <p className="text-xs text-muted-foreground">Премиум-подписка</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={user.isPremium ?? user.is_premium ?? false}
              onClick={async () => {
                const newVal = !(user.isPremium ?? user.is_premium ?? false);
                try {
                  await api.patch(`/admin/users/${id}`, { isPremium: newVal });
                  setUser((prev) => prev ? { ...prev, isPremium: newVal, is_premium: newVal } : prev);
                } catch { alert('Ошибка при обновлении'); }
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                (user.isPremium ?? user.is_premium) ? 'bg-amber-500' : 'bg-muted'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                (user.isPremium ?? user.is_premium) ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </label>
        </div>
      </div>

      {/* Сессии */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold">Активные сессии</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Управление сессиями пользователя. Завершение сессии разлогинит его с этого устройства.
          </p>
        </div>
        {sessionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">Нет активных сессий</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-medium p-3">Устройство</th>
                  <th className="text-left font-medium p-3">IP</th>
                  <th className="text-left font-medium p-3">Создана</th>
                  <th className="text-left font-medium p-3">Последняя активность</th>
                  <th className="text-right font-medium p-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        {sessionDevice(s)}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{s.ip ?? '—'}</td>
                    <td className="p-3 text-muted-foreground">
                      {sessionCreated(s) ? new Date(sessionCreated(s)).toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {sessionLastActive(s) ? new Date(sessionLastActive(s)).toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleTerminateSession(s.id)}
                        disabled={!!terminatingId}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {terminatingId === s.id ? '…' : 'Завершить'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
