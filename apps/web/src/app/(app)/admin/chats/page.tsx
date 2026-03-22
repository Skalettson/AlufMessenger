'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

const PAGE_SIZE = 20;

const CHAT_TYPE_LABELS: Record<number, string> = {
  0: '—',
  1: 'Личный',
  2: 'Группа',
  3: 'Канал',
  4: 'Супергруппа',
  5: 'Сохранённые',
};

interface ChatRow {
  id: string;
  type?: number;
  name?: string;
  title?: string;
  member_count?: number;
  memberCount?: number;
  created_at?: string;
  createdAt?: string;
  creator_id?: string;
  creatorId?: string;
}

export default function AdminChatsPage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
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
        const res = await api.get<{ chats: ChatRow[]; totalCount?: number; total_count?: number }>(
          `/admin/chats?${params}`,
        );
        if (cancelled) return;
        setChats(Array.isArray(res.chats) ? res.chats : []);
        setTotalCount(res.totalCount ?? res.total_count ?? 0);
      } catch {
        if (!cancelled) setChats([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [offset]);

  const title = (c: ChatRow) => c.name ?? c.title ?? c.id;
  const memberCount = (c: ChatRow) => c.memberCount ?? c.member_count ?? 0;
  const createdAt = (c: ChatRow) => c.createdAt ?? c.created_at ?? '';

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Чаты</h1>

      <div className="rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-medium p-3">Название / ID</th>
                  <th className="text-left font-medium p-3">Тип</th>
                  <th className="text-left font-medium p-3">Участников</th>
                  <th className="text-left font-medium p-3">Создан</th>
                </tr>
              </thead>
              <tbody>
                {chats.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/admin/chats/${c.id}`)}
                  >
                    <td className="p-3">
                      <p className="font-medium">{title(c)}</p>
                      <p className="text-muted-foreground text-xs">{c.id}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {CHAT_TYPE_LABELS[c.type ?? 0] ?? c.type}
                    </td>
                    <td className="p-3">{memberCount(c)}</td>
                    <td className="p-3 text-muted-foreground">
                      {createdAt(c) ? new Date(createdAt(c)).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Всего: {totalCount} · Страница {currentPage} из {totalPages}
          </p>
          <div className="flex gap-2">
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
