'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import { api } from '@/lib/api';
import { apiChatToPreview } from '@/lib/chat-mappers';
import type { ChatPreview } from '@/stores/chat-store';
import { useChatStore } from '@/stores/chat-store';
import { uploadFile } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/shared/user-avatar';
import { DisplayNameWithBadge } from '@/components/shared/display-name-with-badge';
import {
  Users,
  MessageSquare,
  Link2,
  Copy,
  Shield,
  AtSign,
  Image,
  Mic,
  FileText,
  Link as LinkIcon,
  ChevronRight,
} from 'lucide-react';

function extractStorageKey(media: { storageKey?: string; url?: string; id?: string }): string {
  const k = (media.storageKey ?? '').trim();
  if (k) return k;
  const u = (media.url ?? '').trim();
  if (u.startsWith('media:')) return u.slice('media:'.length);
  return (media.id ?? '').trim();
}

/** Медиа = фото, видео, видеозаметки, гифки. */
const MEDIA_TYPES = new Set(['image', 'video', 'video_note', 'gif']);
const VOICE_TYPES = new Set(['voice', 'audio']);
const DOCUMENT_TYPES = new Set(['document', 'file']);
const LINK_REGEX = /https?:\/\/[^\s]+/i;

function normalizeContentType(t: unknown): string {
  if (typeof t === 'string') return t.toLowerCase();
  if (typeof t === 'number') {
    const map: Record<number, string> = {
      1: 'text',
      2: 'image',
      3: 'video',
      4: 'audio',
      5: 'document',
      6: 'voice',
      7: 'sticker',
      8: 'gif',
      9: 'location',
      10: 'contact',
      11: 'poll',
      12: 'system',
      13: 'video_note',
    };
    return map[t] ?? 'text';
  }
  return 'text';
}

interface SharedMediaCounts {
  media: number;
  voice: number;
  documents: number;
  links: number;
}

function SharedMediaRow({
  icon,
  label,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors"
    >
      {icon}
      <span className="flex-1 font-medium">{label}</span>
      <span className="text-muted-foreground tabular-nums">{count}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

const typeLabels: Record<string, string> = {
  private: 'Личный чат',
  group: 'Группа',
  channel: 'Канал',
  secret: 'Секретный чат',
  saved: 'Избранное',
};

export interface ChatMember {
  userId: string;
  role?: string;
  displayName?: string;
  avatarUrl?: string | null;
  isPremium?: boolean;
}

export function useChatInfoModel(chatId: string, enabled: boolean, initialTitle = 'Чат') {
  const router = useRouter();
  const updateChatInStore = useChatStore((s) => s.updateChat);
  const [chat, setChat] = useState<ChatPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [channelUsername, setChannelUsername] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [sharedMedia, setSharedMedia] = useState<SharedMediaCounts>({
    media: 0,
    voice: 0,
    documents: 0,
    links: 0,
  });
  const [sharedMediaLoading, setSharedMediaLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const loadChat = useCallback(() => {
    if (!enabled || !chatId) return;
    setLoading(true);
    setError(null);
    api
      .get<unknown>(`/chats/${chatId}`)
      .then((raw) => {
        const mapped = apiChatToPreview(raw as Parameters<typeof apiChatToPreview>[0]);
        setChat(mapped);
        updateChatInStore(chatId, mapped);
      })
      .catch(() => setError('Не удалось загрузить данные чата'))
      .finally(() => setLoading(false));
  }, [enabled, chatId, updateChatInStore]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  useEffect(() => {
    if (!enabled || !chatId) return;

    const loadAllMessages = async () => {
      setSharedMediaLoading(true);
      setSharedMedia({ media: 0, voice: 0, documents: 0, links: 0 });

      const counts: SharedMediaCounts = { media: 0, voice: 0, documents: 0, links: 0 };
      let cursor: string | undefined;
      const limit = 200;
      let hasMore = true;

      try {
        while (hasMore) {
          const url = cursor
            ? `/chats/${chatId}/messages?limit=${limit}&cursor=${encodeURIComponent(cursor)}`
            : `/chats/${chatId}/messages?limit=${limit}`;

          const res = await api.get<{
            messages?: Array<{ contentType?: unknown; textContent?: string }>;
            nextCursor?: string;
            hasMore?: boolean;
          }>(url);

          const list = res?.messages ?? [];
          for (const msg of list) {
            const ct = normalizeContentType(msg.contentType);
            if (MEDIA_TYPES.has(ct)) counts.media++;
            else if (VOICE_TYPES.has(ct)) counts.voice++;
            else if (DOCUMENT_TYPES.has(ct)) counts.documents++;
            const text = (msg.textContent ?? '').trim();
            if (text && LINK_REGEX.test(text)) counts.links++;
          }

          hasMore = res?.hasMore ?? false;
          cursor = res?.nextCursor;
        }
        setSharedMedia(counts);
      } catch {
        setSharedMedia({ media: 0, voice: 0, documents: 0, links: 0 });
      } finally {
        setSharedMediaLoading(false);
      }
    };

    void loadAllMessages();
  }, [enabled, chatId]);

  useEffect(() => {
    if (!enabled || !chatId || (chat?.type !== 'channel' && chat?.type !== 'group' && chat?.type !== 'secret')) return;
    setMembersLoading(true);
    api
      .get<{ members: (ChatMember & { role?: string | number })[] }>(`/chats/${chatId}/members`)
      .then((res) => {
        const list = res.members ?? [];
        if (chat?.type === 'channel') {
          setMembers(
            list.filter((m) => {
              const r = m.role as string | number | undefined;
              return r === 'owner' || r === 'admin' || r === 3 || r === 2;
            }),
          );
        } else {
          setMembers(list);
        }
      })
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, [enabled, chatId, chat?.type]);

  const handleCreateInviteLink = useCallback(() => {
    if (!chatId) return;
    setInviteLoading(true);
    setInviteLink(null);
    api
      .post<{ link?: string; code?: string }>(`/chats/${chatId}/invite-link`, {})
      .then((res) => {
        const code = res?.link ?? res?.code ?? '';
        const url =
          typeof window !== 'undefined'
            ? `${window.location.origin}/join/${code}`
            : `https://example.com/join/${code}`;
        setInviteLink(url);
      })
      .catch(() => setInviteLink(''))
      .finally(() => setInviteLoading(false));
  }, [chatId]);

  const copyInviteLink = useCallback(() => {
    if (!inviteLink) return;
    void navigator.clipboard.writeText(inviteLink);
  }, [inviteLink]);

  useEffect(() => {
    if (chat?.username != null) setChannelUsername(chat.username ?? '');
    else setChannelUsername('');
  }, [chat?.username]);

  const handleSaveUsername = useCallback(async () => {
    if (!chatId) return;
    const value = channelUsername.trim().toLowerCase().replace(/^@/, '') || null;
    setUsernameError(null);
    setUsernameSaving(true);
    try {
      await api.patch(`/chats/${chatId}`, { username: value ?? null });
      loadChat();
    } catch (e: unknown) {
      setUsernameError((e as { message?: string })?.message ?? 'Не удалось сохранить');
    } finally {
      setUsernameSaving(false);
    }
  }, [chatId, channelUsername, loadChat]);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !chatId) return;
      setAvatarUploading(true);
      try {
        const media = await uploadFile(file, chatId);
        const key = extractStorageKey(media);
        if (key) {
          await api.patch(`/chats/${chatId}`, { avatarFileId: key });
          await loadChat();
        }
      } catch {
        // ignore
      } finally {
        setAvatarUploading(false);
      }
    },
    [chatId, loadChat],
  );

  const title = chat?.title ?? initialTitle;
  const typeLabel = chat?.type ? typeLabels[chat.type] ?? chat.type : '—';
  const isChannel = chat?.type === 'channel';
  const isGroup = chat?.type === 'group' || chat?.type === 'secret';
  const canEditChatInfo = (isChannel || isGroup) && (chat?.myRole === 'owner' || chat?.myRole === 'admin');

  const publicChannelUrl =
    typeof window !== 'undefined' && chat?.username
      ? `${window.location.origin}/c/${encodeURIComponent(chat.username)}`
      : '';

  const memberLabel = isChannel
    ? chat?.memberCount === 1
      ? 'подписчик'
      : (chat?.memberCount ?? 0) < 5
        ? 'подписчика'
        : 'подписчиков'
    : 'участников';

  return {
    router,
    chat,
    loading,
    error,
    inviteLink,
    inviteLoading,
    members,
    membersLoading,
    channelUsername,
    setChannelUsername,
    usernameSaving,
    usernameError,
    sharedMedia,
    sharedMediaLoading,
    loadChat,
    handleCreateInviteLink,
    copyInviteLink,
    handleSaveUsername,
    title,
    typeLabel,
    isChannel,
    isGroup,
    canEditChatInfo,
    publicChannelUrl,
    memberLabel,
    chatId,
    initialTitle,
    avatarUploading,
    avatarInputRef,
    handleAvatarChange,
  };
}

export type ChatInfoModel = ReturnType<typeof useChatInfoModel>;

export function ChatInfoBody({
  model,
  onClose,
}: {
  model: ChatInfoModel;
  onClose: () => void;
}) {
  const {
    router,
    chat,
    loading,
    error,
    inviteLink,
    inviteLoading,
    members,
    membersLoading,
    channelUsername,
    setChannelUsername,
    usernameSaving,
    usernameError,
    sharedMedia,
    sharedMediaLoading,
    handleCreateInviteLink,
    copyInviteLink,
    handleSaveUsername,
    title,
    typeLabel,
    isChannel,
    isGroup,
    canEditChatInfo,
    publicChannelUrl,
    memberLabel,
    chatId,
    avatarUploading,
    avatarInputRef,
    handleAvatarChange,
  } = model;

  return (
    <>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleAvatarChange}
      />
      {loading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && chat && (
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center gap-2 pb-2">
            <UserAvatar src={chat?.avatarUrl ?? null} name={title} size="xl" className="h-24 w-24" />
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          {canEditChatInfo && (isChannel || isGroup) && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                {avatarUploading ? 'Загрузка…' : 'Сменить фото группы/канала'}
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Тип:</span>
            <span>{typeLabel}</span>
          </div>

          <div className="space-y-0 border border-border rounded-lg overflow-hidden">
            <p className="text-xs font-medium text-muted-foreground px-3 py-2 bg-muted/30 border-b border-border">
              Общие медиафайлы
            </p>
            {sharedMediaLoading ? (
              <p className="text-sm text-muted-foreground px-3 py-3">Загрузка…</p>
            ) : (
              <div className="divide-y divide-border">
                <SharedMediaRow
                  icon={<Image className="h-4 w-4 text-muted-foreground" />}
                  label="Медиа"
                  count={sharedMedia.media}
                  onClick={() => {
                    onClose();
                    router.push(`/chat/${chatId}`);
                  }}
                />
                <SharedMediaRow
                  icon={<Mic className="h-4 w-4 text-muted-foreground" />}
                  label="Голосовые сообщения"
                  count={sharedMedia.voice}
                  onClick={() => {
                    onClose();
                    router.push(`/chat/${chatId}`);
                  }}
                />
                <SharedMediaRow
                  icon={<FileText className="h-4 w-4 text-muted-foreground" />}
                  label="Файлы"
                  count={sharedMedia.documents}
                  onClick={() => {
                    onClose();
                    router.push(`/chat/${chatId}`);
                  }}
                />
                <SharedMediaRow
                  icon={<LinkIcon className="h-4 w-4 text-muted-foreground" />}
                  label="Ссылки"
                  count={sharedMedia.links}
                  onClick={() => {
                    onClose();
                    router.push(`/chat/${chatId}`);
                  }}
                />
              </div>
            )}
          </div>

          {chat.type !== 'private' && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{isChannel ? 'Подписчиков:' : 'Участников:'}</span>
              <span>
                {chat.memberCount ?? 0} {memberLabel}
              </span>
            </div>
          )}
          {(isChannel || isGroup) && chat.description && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Описание</p>
              <p className="text-sm">{chat.description}</p>
            </div>
          )}
          {(isChannel || isGroup) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <AtSign className="h-3.5 w-3.5" />
                Публичная ссылка (username)
              </p>
              {canEditChatInfo ? (
                <>
                  <div className="flex gap-2">
                    <span className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                      /c/
                    </span>
                    <Input
                      placeholder="username (5–32 символов)"
                      value={channelUsername}
                      onChange={(e) => setChannelUsername(e.target.value)}
                      className="font-mono text-sm"
                      maxLength={32}
                    />
                  </div>
                  {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
                  <Button variant="outline" size="sm" onClick={() => void handleSaveUsername()} disabled={usernameSaving}>
                    {usernameSaving ? 'Сохранение…' : 'Сохранить'}
                  </Button>
                </>
              ) : publicChannelUrl ? (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={publicChannelUrl}
                    className="flex h-9 flex-1 rounded-md border border-input bg-muted/50 px-3 py-1 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => publicChannelUrl && navigator.clipboard.writeText(publicChannelUrl)}
                    title="Копировать"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Владелец не задал публичную ссылку</p>
              )}
            </div>
          )}
          {(isChannel || isGroup) && canEditChatInfo && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Ссылка-приглашение
              </p>
              {!inviteLink ? (
                <Button variant="outline" size="sm" onClick={handleCreateInviteLink} disabled={inviteLoading}>
                  {inviteLoading ? 'Создание…' : 'Создать ссылку'}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={inviteLink}
                    className="flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-1 text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={copyInviteLink} title="Копировать">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
          {(isChannel || isGroup) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                {isChannel ? 'Администраторы' : 'Участники'}
              </p>
              {membersLoading ? (
                <p className="text-sm text-muted-foreground">Загрузка…</p>
              ) : members.length > 0 ? (
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {members.map((m) => (
                    <li key={m.userId} className="flex items-center gap-2 text-sm">
                      <UserAvatar src={m.avatarUrl} name={m.displayName ?? 'Пользователь'} size="sm" />
                      <DisplayNameWithBadge
                        name={m.displayName || 'Пользователь'}
                        isPremium={m.isPremium ?? (m as { is_premium?: boolean }).is_premium}
                        size="sm"
                      />
                      {(m.role === 'owner' || (m as { role?: number }).role === 3) && (
                        <span className="text-xs text-muted-foreground">(владелец)</span>
                      )}
                      {isGroup && (m.role === 'admin' || (m as { role?: number }).role === 2) && (
                        <span className="text-xs text-muted-foreground">(админ)</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Нет данных</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

