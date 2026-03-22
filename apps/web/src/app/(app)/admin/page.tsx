'use client';

import { useEffect, useState } from 'react';
import { Users, MessageCircle, UserPlus, Server } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { UserAvatar } from '@/components/shared/user-avatar';

interface Stats {
  totalUsers: number;
  newUsers24h: number;
  totalChats: number;
}

interface HealthResponse {
  services?: { name: string; status: string }[];
}

interface UserRow {
  id: string;
  username: string;
  displayName?: string;
  display_name?: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  createdAt?: string;
  created_at?: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<UserRow[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [statsRes, usersRes, healthRes] = await Promise.all([
          api.get<Stats>('/admin/stats'),
          api.get<{ users: UserRow[] }>('/admin/users?limit=5&offset=0'),
          api.get<HealthResponse>('/admin/system/health').catch(() => null),
        ]);
        if (cancelled) return;
        setStats({
          totalUsers: statsRes.totalUsers ?? 0,
          newUsers24h: statsRes.newUsers24h ?? 0,
          totalChats: statsRes.totalChats ?? 0,
        });
        setRecentUsers(Array.isArray(usersRes.users) ? usersRes.users : []);
        setHealth(healthRes ?? null);
      } catch {
        if (!cancelled) {
          setStats({ totalUsers: 0, newUsers24h: 0, totalChats: 0 });
          setRecentUsers([]);
          setHealth(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);
  const healthyServices = health?.services?.filter((s) => s.status === 'ok').length ?? 0;
  const totalServices = health?.services?.length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Панель управления</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Статистика и быстрый доступ к разделам
        </p>
      </div>

      {/* Статистика */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/users"
          className="rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:bg-accent/30 hover:border-primary/30"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Пользователи</p>
              <p className="text-3xl font-bold tabular-nums mt-1">
                {loading ? '—' : stats?.totalUsers ?? '—'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <Users className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Всего в системе</p>
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Новых за 24 ч</p>
              <p className="text-3xl font-bold tabular-nums mt-1 text-green-600 dark:text-green-400">
                {loading ? '—' : stats?.newUsers24h ?? '—'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/15">
              <UserPlus className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Регистрации за сутки</p>
        </div>

        <Link
          href="/admin/chats"
          className="rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:bg-accent/30 hover:border-primary/30"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Чаты</p>
              <p className="text-3xl font-bold tabular-nums mt-1">
                {loading ? '—' : stats?.totalChats ?? '—'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Всего чатов</p>
        </Link>

        <Link
          href="/admin/system"
          className="rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:bg-accent/30 hover:border-primary/30"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Сервисы</p>
              <p className="text-3xl font-bold tabular-nums mt-1">
                {loading ? '—' : totalServices > 0 ? `${healthyServices}/${totalServices}` : '—'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <Server className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Мониторинг и система</p>
        </Link>
      </div>

      {/* Последние пользователи */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold">Последние пользователи</h2>
          <Link
            href="/admin/users"
            className="text-sm text-primary hover:underline"
          >
            Все пользователи →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : recentUsers.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">Нет данных</p>
          ) : (
            recentUsers.map((u) => {
              const name = u.displayName ?? u.display_name ?? u.username;
              const created = u.createdAt ?? u.created_at;
              return (
                <Link
                  key={u.id}
                  href={`/admin/users/${u.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors"
                >
                  <UserAvatar
                    src={u.avatarUrl ?? u.avatar_url ?? null}
                    name={name}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{name}</p>
                    <p className="text-sm text-muted-foreground">@{u.username}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {created ? new Date(created).toLocaleDateString() : '—'}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
