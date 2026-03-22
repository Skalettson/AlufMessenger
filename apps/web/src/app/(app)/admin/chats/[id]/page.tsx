'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, MessageSquareOff, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

const CHAT_TYPE_LABELS: Record<number, string> = {
  0: '—',
  1: 'Личный',
  2: 'Группа',
  3: 'Канал',
  4: 'Супергруппа',
  5: 'Сохранённые',
};

interface ChatDetail {
  id: string;
  type?: number;
  name?: string;
  title?: string;
  description?: string;
  member_count?: number;
  memberCount?: number;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  creator_id?: string;
  creatorId?: string;
  avatar_url?: string;
  avatarUrl?: string;
}

export default function AdminChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'clear' | 'delete' | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<ChatDetail>(`/admin/chats/${id}`);
        if (cancelled) return;
        setChat(res);
      } catch (e) {
        if (!cancelled) setError('Не удалось загрузить чат или нет доступа');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const handleClearMessages = async () => {
    if (!confirm('Удалить все сообщения в этом чате? Действие необратимо.')) return;
    setActionLoading('clear');
    try {
      await api.post(`/admin/chats/${id}/clear-messages`, {});
      alert('Сообщения чата удалены.');
      setChat((c) => c ? { ...c } : null);
    } catch (e) {
      alert('Не удалось очистить сообщения.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteChat = async () => {
    if (!confirm('Удалить чат полностью? Все участники потеряют доступ, все сообщения будут удалены. Действие необратимо.')) return;
    setActionLoading('delete');
    try {
      await api.delete(`/admin/chats/${id}`);
      router.push('/admin/chats');
    } catch (e) {
      alert('Не удалось удалить чат.');
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="space-y-4">
        <Link href="/admin/chats" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> К списку чатов
        </Link>
        <p className="text-destructive">{error ?? 'Чат не найден'}</p>
      </div>
    );
  }

  const title = chat.name ?? chat.title ?? chat.id;
  const memberCount = chat.memberCount ?? chat.member_count ?? 0;
  const createdAt = chat.createdAt ?? chat.created_at;
  const updatedAt = chat.updatedAt ?? chat.updated_at;
  const isSaved = chat.type === 5;

  return (
    <div className="space-y-8">
      <Link href="/admin/chats" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> К списку чатов
      </Link>

      {/* Информация о чате */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-muted-foreground text-sm">ID: {chat.id}</p>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Тип</dt>
              <dd>{CHAT_TYPE_LABELS[chat.type ?? 0] ?? chat.type}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Участников</dt>
              <dd>{memberCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Создатель (ID)</dt>
              <dd className="font-mono text-xs">{chat.creatorId ?? chat.creator_id ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Создан</dt>
              <dd>{createdAt ? new Date(createdAt).toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Обновлён</dt>
              <dd>{updatedAt ? new Date(updatedAt).toLocaleString() : '—'}</dd>
            </div>
          </dl>
          {chat.description && (
            <div>
              <dt className="text-muted-foreground text-sm">Описание</dt>
              <dd className="mt-1 text-sm">{chat.description}</dd>
            </div>
          )}
        </div>
      </div>

      {/* Опасная зона */}
      <div className="rounded-xl border border-destructive/30 bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/5 px-6 py-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="font-semibold text-destructive">Опасная зона</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border border-border bg-muted/20">
            <div>
              <p className="font-medium">Очистить все сообщения</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Удалить все сообщения в чате. Участники и чат останутся.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10 shrink-0"
              onClick={handleClearMessages}
              disabled={!!actionLoading}
            >
              <MessageSquareOff className="h-4 w-4 mr-2" />
              {actionLoading === 'clear' ? 'Выполняется…' : 'Очистить сообщения'}
            </Button>
          </div>

          {!isSaved && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border border-destructive/50 bg-destructive/5">
              <div>
                <p className="font-medium text-destructive">Удалить чат</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Полное удаление чата, участников и сообщений. Необратимо.
                </p>
              </div>
              <Button
                variant="destructive"
                className="shrink-0"
                onClick={handleDeleteChat}
                disabled={!!actionLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {actionLoading === 'delete' ? 'Выполняется…' : 'Удалить чат'}
              </Button>
            </div>
          )}
          {isSaved && (
            <p className="text-sm text-muted-foreground">
              Чаты «Сохранённые» удалять через админку нельзя.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
