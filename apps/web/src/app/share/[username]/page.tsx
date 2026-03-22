'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
import { MessageCircle, Loader2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ResolvedUser {
  id?: string;
  user_id?: string;
  displayName?: string;
  display_name?: string;
  username?: string;
  avatarUrl?: string;
  avatar_url?: string;
  bio?: string;
}

export default function ShareProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = ((params.username as string) ?? '').trim().replace(/^@/, '');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'not-found' | 'error'>('loading');
  const [profile, setProfile] = useState<ResolvedUser | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('aluf_redirect_after_auth', `/share/${username}`);
      }
      router.replace('/auth');
      return;
    }

    if (!username) {
      setStatus('not-found');
      return;
    }

    let cancelled = false;

    async function resolve() {
      try {
        const user = await api.get<ResolvedUser>(`/users/${encodeURIComponent(username)}`);
        if (cancelled) return;

        const userId = user?.id ?? user?.user_id;
        if (!userId) {
          setStatus('not-found');
          return;
        }

        setProfile(user);
        setStatus('redirecting');

        const chat = await api.post<{ id?: string; chat_id?: string }>('/chats', {
          type: 'private',
          memberIds: [String(userId).trim()],
        });
        if (cancelled) return;

        const chatId = chat?.id ?? chat?.chat_id;
        if (!chatId) {
          setErrorMsg('Не удалось создать чат');
          setStatus('error');
          return;
        }

        router.replace(`/chat/${chatId}`);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = (err as { message?: string })?.message ?? '';
        if (msg.includes('not found') || msg.includes('404') || msg.includes('Not Found')) {
          setStatus('not-found');
        } else {
          setErrorMsg(msg || 'Произошла ошибка');
          setStatus('error');
        }
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [username, isAuthenticated, isLoading, router]);

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto overscroll-y-contain items-center justify-center bg-background px-4 py-8 safe-area-top safe-area-bottom">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary shadow-lg shadow-primary/30">
            <MessageCircle className="h-10 w-10 text-white" />
          </div>
        </div>

        {(status === 'loading' || status === 'redirecting') && (
          <div className="space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">
              {status === 'loading' ? 'Ищем пользователя...' : `Открываем чат с ${profile?.displayName ?? profile?.display_name ?? username}...`}
            </p>
          </div>
        )}

        {status === 'not-found' && (
          <div className="space-y-3">
            <UserX className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-semibold">Пользователь не найден</h2>
            <p className="text-sm text-muted-foreground">
              Пользователь <span className="font-mono font-medium text-foreground">@{username}</span> не существует или был удалён.
            </p>
            <Link href="/chat">
              <Button className="rounded-xl gradient-primary border-0 text-white mt-2">
                Перейти в мессенджер
              </Button>
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-destructive">Ошибка</h2>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Link href="/chat">
              <Button className="rounded-xl gradient-primary border-0 text-white mt-2">
                Перейти в мессенджер
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
