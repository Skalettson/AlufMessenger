'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { UserAvatar } from '@/components/shared/user-avatar';

const PAGE_SIZE = 20;

interface UserRow {
  id: string;
  username: string;
  display_name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  created_at?: string;
  createdAt?: string;
  last_seen_at?: string | null;
  lastSeenAt?: string | null;
  is_online?: boolean;
  isOnline?: boolean;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (search.trim()) params.set('search', search.trim());
        const res = await api.get<{ users: UserRow[]; totalCount?: number; total_count?: number }>(
          `/admin/users?${params}`,
        );
        if (cancelled) return;
        setUsers(Array.isArray(res.users) ? res.users : []);
        setTotalCount(res.totalCount ?? res.total_count ?? 0);
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [offset, search]);

  const displayName = (u: UserRow) => u.displayName ?? u.display_name ?? u.username;
  const createdAt = (u: UserRow) => u.createdAt ?? u.created_at ?? '';
  const lastSeen = (u: UserRow) => u.lastSeenAt ?? u.last_seen_at ?? null;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Пользователи</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или username..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
            className="pl-9"
          />
          <Button
            size="sm"
            variant="secondary"
            className="mt-2 sm:mt-0 sm:absolute sm:right-1 sm:top-1/2 sm:-translate-y-1/2"
            onClick={() => setSearch(searchInput)}
          >
            Найти
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[560px] text-xs sm:text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-medium p-3">Пользователь</th>
                  <th className="text-left font-medium p-3">Контакты</th>
                  <th className="text-left font-medium p-3">Регистрация</th>
                  <th className="text-left font-medium p-3">Активность</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          src={u.avatarUrl ?? u.avatar_url ?? null}
                          name={displayName(u)}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium">{displayName(u)}</p>
                          <p className="text-muted-foreground">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {u.email || u.phone || '—'}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {createdAt(u) ? new Date(createdAt(u)).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3">
                      {u.isOnline ?? u.is_online ? (
                        <span className="text-green-600">В сети</span>
                      ) : lastSeen(u) ? (
                        new Date(lastSeen(u) as string).toLocaleString()
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && totalCount > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Всего: {totalCount} · Страница {currentPage} из {totalPages}
          </p>
          <div className="flex justify-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" /> Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= totalCount}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Вперёд <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
