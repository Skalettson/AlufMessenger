'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, UserPlus, UserPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { DisplayNameWithBadge } from '@/components/shared/display-name-with-badge';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatLastSeen, getProxiedImageUrl, cn } from '@/lib/utils';
import type { User } from '@/types';

/** API может вернуть snake_case (gRPC); приводим к User. */
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

interface ProfileCardProps {
  userId: string;
  initialTitle?: string | null;
  initialAvatar?: string | null;
  initialIsBot?: boolean;
  onClose: () => void;
}

export function ProfileCard({
  userId,
  initialTitle,
  initialAvatar,
  initialIsBot,
  onClose,
}: ProfileCardProps) {
  const currentUserId = useAuthStore((s) => s.user?.id ?? '');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactToast, setContactToast] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<Record<string, unknown>>(`/users/profile/${userId}`)
      .then((data) => {
        if (!cancelled) setUser(normalizeUserResponse(data ?? {}));
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const displayName = (user?.displayName?.trim() || initialTitle?.trim()) || 'Пользователь';
  const avatarUrl = (user?.avatarUrl?.trim() || initialAvatar?.trim()) || null;
  const coverRaw = user?.coverUrl?.trim() || null;
  const coverUrl = getProxiedImageUrl(coverRaw);
  const isBot = user?.isBot ?? initialIsBot ?? false;
  const username = (user?.username?.trim() || '').replace(/^@/, '') || undefined;
  const bio = user?.bio?.trim() || null;
  const isOnline = user?.isOnline;
  const statusText = user?.statusText?.trim() || null;
  const lastSeenAt = user?.lastSeenAt ?? null;
  const isPremium = user?.isPremium ?? false;
  const premiumBadgeEmoji = user?.premiumBadgeEmoji ?? null;
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

  const statusLine = loading
    ? null
    : isBot
      ? 'Бот · всегда доступен'
      : isOnline === true
        ? 'В сети'
        : lastSeenAt
          ? `Был(а) в сети ${formatLastSeen(lastSeenAt)}`
          : 'Не в сети';

  const aboutParts: string[] = [];
  if (statusText) {
    const line = user?.statusEmoji ? `${user.statusEmoji} ${statusText}` : statusText;
    aboutParts.push(line);
  }
  if (bio) aboutParts.push(bio);
  const showAbout = !loading && (aboutParts.length > 0 || isBot);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 z-20 h-9 w-9 rounded-full text-white/90 hover:text-white hover:bg-black/30"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Как в настройках профиля: обложка + аватар с заходом на карточку */}
          <div className="relative rounded-t-2xl overflow-hidden shadow-lg">
            <div className="h-36 relative bg-gradient-to-br from-primary/80 to-primary">
              {coverUrl ? (
                <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/35" />
            </div>
            <div className="bg-card px-6 pb-5 pt-0">
              <div className="flex items-end gap-4 -mt-12">
                <div className="relative shrink-0">
                  <div className="size-24 overflow-hidden rounded-full p-1 bg-card shadow-lg ring-2 ring-background">
                    <UserAvatar
                      src={avatarUrl}
                      name={displayName}
                      size="xl"
                      className={cn('size-24 text-2xl', isBot && 'ring-2 ring-primary/25')}
                    />
                  </div>
                  {!isBot && isOnline && (
                    <span
                      className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-card shadow-sm"
                      title="В сети"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1 pt-1">
                  {loading ? (
                    <>
                      <div className="h-6 w-40 rounded-md bg-muted animate-pulse" />
                      <div className="h-4 w-28 rounded bg-muted/70 animate-pulse mt-2" />
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-bold truncate flex items-center gap-2">
                        <DisplayNameWithBadge
                          name={displayName}
                          isPremium={isPremium}
                          badgeEmoji={premiumBadgeEmoji}
                          isBot={isBot}
                        />
                        {isBot && <Bot className="h-4 w-4 text-primary shrink-0" aria-hidden />}
                      </h2>
                      {username ? (
                        <p className="text-sm text-muted-foreground font-medium truncate">@{username}</p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {statusLine && (
            <div className="px-6 py-2 border-b border-border/60 bg-card">
              <p className="text-sm text-muted-foreground text-center">
                {statusLine === 'В сети' ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">В сети</span>
                ) : (
                  statusLine
                )}
              </p>
            </div>
          )}

          {showAbout && (
            <div className="px-6 py-4 space-y-3">
              {aboutParts.map((block, i) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {block}
                </p>
              ))}
              {isBot && !bio && !statusText && (
                <p className="text-sm text-muted-foreground">Официальный бот Aluf</p>
              )}
            </div>
          )}

          {!loading && !isBot && !isSelf && (
            <div className="border-t border-border/60 px-6 py-4">
              {contactToast ? (
                <p className="mb-2 text-xs text-destructive">{contactToast}</p>
              ) : null}
              <Button
                type="button"
                className="w-full rounded-xl gap-2"
                variant={isContact ? 'secondary' : 'default'}
                onClick={openContactDialog}
              >
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

          {loading && (
            <div className="px-6 pb-6">
              <div className="h-12 rounded-lg bg-muted/50 animate-pulse" />
            </div>
          )}
        </motion.div>

        <Dialog open={contactOpen} onOpenChange={setContactOpen}>
          <DialogContent className="rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{isContact ? 'Контакт' : 'Новый контакт'}</DialogTitle>
              <DialogDescription className="sr-only">
                Имя и фамилия для отображения в списке контактов (без номера телефона)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pc-first">Имя</Label>
                <Input id="pc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Имя" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-last">Фамилия</Label>
                <Input id="pc-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Фамилия" className="rounded-xl" />
              </div>
              <Button type="button" className="w-full rounded-xl" disabled={contactBusy} onClick={submitContact}>
                {contactBusy ? 'Сохранение…' : isContact ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AnimatePresence>
  );
}
