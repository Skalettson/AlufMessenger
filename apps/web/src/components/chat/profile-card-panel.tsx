'use client';

import { useEffect, useState } from 'react';
import { X, UserPlus, UserPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { DisplayNameWithBadge } from '@/components/shared/display-name-with-badge';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatLastSeen } from '@/lib/utils';
import type { User } from '@/types';

function normalizeUserResponse(raw: Record<string, unknown>): User {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : false);
  const ts = (v: unknown) => {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && 'seconds' in v) {
      const s = (v as { seconds?: number }).seconds ?? 0;
      return new Date(s * 1000).toISOString();
    }
    return null;
  };
  return {
    id: str(raw.id),
    alufId: str(raw.alufId ?? raw.aluf_id ?? ''),
    username: str(raw.username),
    displayName: str(raw.displayName ?? raw.display_name),
    avatarUrl: str(raw.avatarUrl ?? raw.avatar_url) || null,
    coverUrl: str(raw.coverUrl ?? raw.cover_url) || null,
    bio: str(raw.bio) || null,
    statusText: str(raw.statusText ?? raw.status_text) || null,
    statusEmoji: str(raw.statusEmoji ?? raw.status_emoji) || null,
    premiumBadgeEmoji: (raw.premiumBadgeEmoji ?? raw.premium_badge_emoji) != null ? str(raw.premiumBadgeEmoji ?? raw.premium_badge_emoji) : undefined,
    isPremium: bool(raw.isPremium ?? raw.is_premium),
    isBot: bool(raw.isBot ?? raw.is_bot),
    isOnline: raw.is_online !== undefined ? bool(raw.is_online) : (raw.isOnline !== undefined ? bool(raw.isOnline) : undefined),
    lastSeenAt: ts(raw.lastSeenAt ?? raw.last_seen_at) ?? null,
    isContact: bool(raw.isContact ?? raw.is_contact),
  };
}

interface Props {
  userId: string;
  initialTitle?: string | null;
  initialAvatar?: string | null;
  initialIsBot?: boolean;
  onClose: () => void;
}

export function ProfileCardPanel({ userId, initialTitle, initialAvatar, initialIsBot, onClose }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id ?? '');
  const [user, setUser] = useState<User | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactToast, setContactToast] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get<Record<string, unknown>>(`/users/profile/${userId}`)
      .then((data) => {
        if (!cancelled) setUser(normalizeUserResponse(data ?? {}));
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const displayName = (user?.displayName?.trim() || initialTitle?.trim()) || 'Пользователь';
  const avatarUrl = (user?.avatarUrl?.trim() || initialAvatar?.trim()) || null;
  const isBot = user?.isBot ?? initialIsBot ?? false;
  const username = (user?.username?.trim() || '').replace(/^@/, '') || undefined;
  const statusLine = isBot
    ? 'Бот · всегда доступен'
    : user?.isOnline
      ? 'В сети'
      : user?.lastSeenAt
        ? `Был(а) в сети ${formatLastSeen(user.lastSeenAt)}`
        : 'Не в сети';

  const isSelf = currentUserId && userId === currentUserId;
  const isContact = Boolean(user?.isContact);

  const openContactDialog = () => {
    setContactToast('');
    setFirstName('');
    setLastName('');
    setContactOpen(true);
  };

  const submitContact = async () => {
    setContactBusy(true);
    setContactToast('');
    try {
      if (isContact) {
        await api.patch(`/users/me/contacts/${userId}`, { firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined });
      } else {
        await api.post('/users/me/contacts', { userId, firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined });
      }
      setUser((prev) => (prev ? { ...prev, isContact: true } : prev));
      setContactOpen(false);
    } catch (err) {
      setContactToast(getErrorMessage(err) || 'Не удалось сохранить');
    } finally {
      setContactBusy(false);
    }
  };

  return (
    <aside className="hidden lg:flex w-[360px] border-l border-border bg-card h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Информация</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-5 space-y-4 overflow-y-auto">
        <div className="flex flex-col items-center text-center">
          <UserAvatar src={avatarUrl} name={displayName} size="xl" className="h-24 w-24" />
          <div className="mt-3">
            <DisplayNameWithBadge
              name={displayName}
              isPremium={user?.isPremium}
              badgeEmoji={user?.premiumBadgeEmoji}
              isBot={isBot}
              isVerified={(user as unknown as { isVerified?: boolean })?.isVerified}
              isOfficial={(user as unknown as { isOfficial?: boolean })?.isOfficial}
            />
          </div>
          {username && <p className="text-sm text-muted-foreground mt-1">@{username}</p>}
          <p className="text-xs text-muted-foreground mt-2">{statusLine}</p>
        </div>
        {user?.bio && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">О себе</p>
            <p className="text-sm whitespace-pre-wrap">{user.bio}</p>
          </div>
        )}
        {user && !isBot && !isSelf && (
          <div className="pt-2 border-t border-border">
            {contactToast ? <p className="mb-2 text-xs text-destructive">{contactToast}</p> : null}
            <Button type="button" className="w-full rounded-xl gap-2" variant={isContact ? 'secondary' : 'default'} onClick={openContactDialog}>
              {isContact ? (
                <>
                  <UserPen className="h-4 w-4" />
                  Изменить контакт
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Добавить в контакты
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isContact ? 'Контакт' : 'Новый контакт'}</DialogTitle>
            <DialogDescription className="sr-only">Имя для отображения в контактах</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pcp-first">Имя</Label>
              <Input id="pcp-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Имя" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pcp-last">Фамилия</Label>
              <Input id="pcp-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Фамилия" className="rounded-xl" />
            </div>
            <Button type="button" className="w-full rounded-xl" disabled={contactBusy} onClick={submitContact}>
              {contactBusy ? 'Сохранение…' : isContact ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
