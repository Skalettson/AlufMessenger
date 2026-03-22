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
import { Megaphone, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function JoinByCodePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const [chat, setChat] = useState<ChatPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const addChat = useChatStore((s) => s.addChat);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      setError('Неверная ссылка');
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<unknown>(`/chats/join/${encodeURIComponent(code)}`)
      .then((raw) => {
        const mapped = apiChatToPreview(raw as Parameters<typeof apiChatToPreview>[0]);
        setChat(mapped);
      })
      .catch(() => {
        setError('Ссылка недействительна или истекла');
        setChat(null);
      })
      .finally(() => setLoading(false));
  }, [code]);

  const handleJoin = async () => {
    if (!chat?.id || !user) return;
    setJoining(true);
    setError(null);
    try {
      await api.post(`/chats/${chat.id}/join`, { inviteLink: code });
      addChat(chat);
      router.push(`/chat/${chat.id}`);
    } catch {
      setError('Не удалось присоединиться');
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
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto overscroll-y-contain px-4 py-8 safe-area-top safe-area-bottom">
        <p className="text-center text-muted-foreground">{error}</p>
        <Button asChild variant="outline">
          <Link href="/">На главную</Link>
        </Button>
      </div>
    );
  }

  if (!chat) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto overscroll-y-contain px-4 py-8 safe-area-top safe-area-bottom">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 shadow-lg max-w-sm w-full">
        <UserAvatar src={chat.avatarUrl ?? undefined} name={chat.title ?? 'Без названия'} size="xl" />
        {chat.type === 'channel' && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Megaphone className="h-4 w-4" />
            Канал
          </span>
        )}
        <h1 className="text-xl font-semibold text-center">{chat.title ?? 'Без названия'}</h1>
        {chat.description && (
          <p className="text-sm text-muted-foreground text-center">{chat.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {chat.memberCount} {chat.memberCount === 1 ? 'подписчик' : 'подписчиков'}
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
            ) : (
              'Присоединиться'
            )}
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link href="/auth">Войти, чтобы присоединиться</Link>
          </Button>
        )}
      </div>
      <Button asChild variant="ghost">
        <Link href="/">На главную</Link>
      </Button>
    </div>
  );
}
