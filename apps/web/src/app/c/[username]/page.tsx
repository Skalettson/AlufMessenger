'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { apiChatToPreview } from '@/lib/chat-mappers';
import type { ChatPreview } from '@/stores/chat-store';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Megaphone, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ChannelByUsernamePage() {
  const params = useParams();
  const router = useRouter();
  const username = (params.username as string)?.trim().replace(/^@/, '') ?? '';
  const [chat, setChat] = useState<ChatPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const addChat = useChatStore((s) => s.addChat);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      setError('Укажите username канала');
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<unknown>(`/chats/by-username/${encodeURIComponent(username)}`)
      .then((raw) => {
        const mapped = apiChatToPreview(raw as Parameters<typeof apiChatToPreview>[0]);
        setChat(mapped);
      })
      .catch(() => {
        setError('Канал не найден');
        setChat(null);
      })
      .finally(() => setLoading(false));
  }, [username]);

  const [isMember, setIsMember] = useState<boolean | null>(null);
  useEffect(() => {
    if (!chat?.id || !user) {
      setIsMember(null);
      return;
    }
    api
      .get<{ myRole?: string }>(`/chats/${chat.id}`)
      .then((data) => {
        setIsMember(!!(data?.myRole != null && data.myRole !== ''));
      })
      .catch(() => setIsMember(false));
  }, [chat?.id, user]);

  useEffect(() => {
    if (chat?.id && user && isMember === true) {
      router.replace(`/chat/${chat.id}`);
    }
  }, [chat?.id, user, isMember, router]);

  const handleJoin = async () => {
    if (!chat?.id || !user) return;
    setJoining(true);
    setError(null);
    try {
      await api.post(`/chats/${chat.id}/join`, {});
      addChat(chat);
      router.push(`/chat/${chat.id}`);
    } catch {
      setError('Не удалось подписаться на канал');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !chat) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto overscroll-y-contain px-4 py-8 safe-area-top safe-area-bottom">
        <p className="text-center text-muted-foreground">{error}</p>
        <Button asChild variant="outline">
          <Link href="/">На главную</Link>
        </Button>
      </div>
    );
  }

  if (!chat) return null;

  if (user && isMember === true) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto overscroll-y-contain px-4 py-8 safe-area-top safe-area-bottom">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 shadow-lg max-w-sm w-full">
        <UserAvatar src={chat.avatarUrl ?? undefined} name={chat.title ?? (chat.type === 'channel' ? 'Канал' : 'Группа')} size="xl" />
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {chat.type === 'channel' ? <Megaphone className="h-4 w-4" /> : <Users className="h-4 w-4" />}
          {chat.type === 'channel' ? 'Канал' : 'Группа'}
        </span>
        <h1 className="text-xl font-semibold text-center">{chat.title ?? 'Без названия'}</h1>
        {chat.description && (
          <p className="text-sm text-muted-foreground text-center">{chat.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {chat.memberCount}{' '}
          {chat.type === 'channel'
            ? chat.memberCount === 1 ? 'подписчик' : 'подписчиков'
            : chat.memberCount === 1 ? 'участник' : 'участников'}
        </p>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        {user ? (
          <Button
            className="w-full"
            onClick={handleJoin}
            disabled={joining}
          >
            {joining ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : chat.type === 'channel' ? (
              'Подписаться'
            ) : (
              'Присоединиться'
            )}
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link href="/auth">{chat.type === 'channel' ? 'Войти, чтобы подписаться' : 'Войти, чтобы присоединиться'}</Link>
          </Button>
        )}
      </div>
      <Button asChild variant="ghost">
        <Link href="/">На главную</Link>
      </Button>
    </div>
  );
}
