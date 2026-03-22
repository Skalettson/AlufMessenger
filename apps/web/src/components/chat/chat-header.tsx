'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Phone, Video, Search, MoreVertical, Info, Users, BellOff, LogOut, Bot, Pin, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { DisplayNameWithBadge } from '@/components/shared/display-name-with-badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/stores/ui-store';
import { useCallStore } from '@/stores/call-store';
import { useMessageStore } from '@/stores/message-store';
import { useChatStore } from '@/stores/chat-store';
import { usePresenceStore } from '@/stores/presence-store';
import { api } from '@/lib/api';
import { cn, formatLastSeen } from '@/lib/utils';

const EMPTY_TYPING: { userId: string; username: string }[] = [];

interface Props {
  title: string;
  avatarUrl: string | null;
  memberCount: number;
  /** Тип чата: private, group, channel, saved и т.д. Если не передан — показываем «Загрузка...» */
  chatType?: string;
  chatId: string;
  isBot?: boolean;
  isPremium?: boolean;
  /** Кастомный эмодзи бейджа Premium собеседника (личный чат) */
  badgeEmoji?: string | null;
  profileUserId?: string | null;
}

export function ChatHeader({ title, avatarUrl, memberCount, chatType, chatId, isBot, isPremium, badgeEmoji, profileUserId }: Props) {
  const router = useRouter();
  const openModal = useUiStore((s) => s.openModal);
  const setActiveCall = useUiStore((s) => s.setActiveCall);
  const { startCall } = useCallStore();
  const updateChat = useChatStore((s) => s.updateChat);
  const chat = useChatStore((s) => s.chats.find((c) => c.id === chatId));
  const typingUsers = useMessageStore((s) => s.typingUsers[chatId] ?? EMPTY_TYPING);
  const peerPresence = usePresenceStore((s) => (profileUserId ? s.byUserId[profileUserId] : undefined));
  const setBulkPresence = usePresenceStore((s) => s.setBulk);
  const isMuted = chat?.isMuted ?? false;
  const isPinned = chat?.isPinned ?? false;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Подгружаем presence для открытого личного чата, если ещё нет в сторе
  useEffect(() => {
    if (chatType !== 'private' || !profileUserId || peerPresence !== undefined) return;
    let cancelled = false;
    api
      .get<Record<string, { isOnline?: boolean; lastSeenAt?: string }>>(`/users/presence?ids=${encodeURIComponent(profileUserId)}`)
      .then((res) => {
        if (cancelled || !res || typeof res !== 'object') return;
        const v = res[profileUserId];
        if (v && typeof v === 'object') {
          setBulkPresence({
            [profileUserId]: { isOnline: v.isOnline ?? false, lastSeenAt: v.lastSeenAt ?? null },
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chatType, profileUserId, peerPresence, setBulkPresence]);

  const isTyping = typingUsers.length > 0;
  const privateStatusSubtitle =
    peerPresence?.isOnline === true
      ? 'В сети'
      : peerPresence?.lastSeenAt
        ? `Был(а) в сети ${formatLastSeen(peerPresence.lastSeenAt)}`
        : 'Не в сети';
  const subtitle = isTyping
    ? `${typingUsers.map((u) => u.username).join(', ')} печатает...`
    : !chatType
      ? 'Загрузка...'
      : chatType === 'saved'
        ? 'Сохранённые сообщения'
        : chatType === 'channel'
          ? `${memberCount} ${memberCount === 1 ? 'подписчик' : memberCount < 5 ? 'подписчика' : 'подписчиков'}`
          : chatType === 'private' && isBot
            ? 'Бот'
            : chatType === 'private'
              ? privateStatusSubtitle
              : chatType === 'group' || chatType === 'secret'
                ? `${memberCount} участников`
                : 'Загрузка...';

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const t = setTimeout(close, 0);
    document.addEventListener('click', close);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleHeaderClick = () => {
    if (profileUserId) {
      openModal('profile-card', {
        userId: profileUserId,
        initialTitle: title,
        initialAvatar: avatarUrl,
        initialIsBot: isBot,
      });
    } else if (chatType === 'channel' || chatType === 'group' || chatType === 'secret') {
      handleChatInfo();
    }
  };

  const isHeaderClickable = !!profileUserId || chatType === 'channel' || chatType === 'group' || chatType === 'secret';

  const menuAction = (fn: () => void) => {
    setContextMenu(null);
    fn();
  };

  const handleVoiceCall = async () => {
    try {
      const call = await startCall(chatId, 'voice');
      if (call?.id) {
        setActiveCall({
          callId: call.id,
          chatId,
          chatTitle: title,
          chatAvatar: avatarUrl,
          callType: 'voice',
          isIncoming: false,
          peerUserId: profileUserId ?? null,
        });
      }
    } catch {
      // ignore
    }
  };

  const handleVideoCall = async () => {
    try {
      const call = await startCall(chatId, 'video');
      if (call?.id) {
        setActiveCall({
          callId: call.id,
          chatId,
          chatTitle: title,
          chatAvatar: avatarUrl,
          callType: 'video',
          isIncoming: false,
          peerUserId: profileUserId ?? null,
        });
      }
    } catch {
      // ignore
    }
  };

  const handleChatInfo = () => openModal('chat-info', { chatId, title });
  const handleSearch = () => openModal('chat-search', { chatId, title });
  const handleToggleMute = async () => {
    try {
      if (isMuted) {
        await api.delete(`/chats/${chatId}/mute`);
        updateChat(chatId, { isMuted: false });
      } else {
        await api.post(`/chats/${chatId}/mute`, {});
        updateChat(chatId, { isMuted: true });
      }
    } catch {
      // ignore
    }
  };
  const handleTogglePin = async () => {
    try {
      if (isPinned) {
        await api.delete(`/chats/${chatId}/pin`);
        updateChat(chatId, { isPinned: false });
      } else {
        await api.post(`/chats/${chatId}/pin`);
        updateChat(chatId, { isPinned: true });
      }
    } catch {
      // ignore
    }
  };
  const handleLeaveChat = async () => {
    try {
      await api.post(`/chats/${chatId}/leave`);
      setContextMenu(null);
      router.push('/chat');
    } catch {
      // ignore
    }
  };

  const settingsMenuLabel =
    chatType === 'channel' ? 'Настройки канала' : chatType === 'group' || chatType === 'secret' ? 'Настройки группы' : 'Информация о чате';

  const contextMenuItems = (
    <>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent rounded-sm cursor-pointer font-medium"
        onClick={() => menuAction(handleChatInfo)}
      >
        <Info className="h-4 w-4" /> {settingsMenuLabel}
      </button>
      {chatType !== 'private' && chatType !== 'saved' && (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent rounded-sm cursor-pointer"
          onClick={() => menuAction(handleChatInfo)}
        >
          <Users className="h-4 w-4" /> Участники
        </button>
      )}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent rounded-sm cursor-pointer text-muted-foreground"
        onClick={() => menuAction(handleToggleMute)}
      >
        <BellOff className="h-4 w-4" /> {isMuted ? 'Включить уведомления' : 'Отключить уведомления'}
      </button>
      {chatType !== 'saved' && (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent rounded-sm cursor-pointer"
          onClick={() => menuAction(handleTogglePin)}
        >
          <Pin className="h-4 w-4" /> {isPinned ? 'Открепить чат' : 'Закрепить чат'}
        </button>
      )}
      {chatType !== 'private' && chatType !== 'saved' && (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive rounded-sm cursor-pointer"
          onClick={() => menuAction(handleLeaveChat)}
        >
          <LogOut className="h-4 w-4" /> {chatType === 'channel' ? 'Отписаться от канала' : chatType === 'group' || chatType === 'secret' ? 'Покинуть группу' : 'Покинуть чат'}
        </button>
      )}
    </>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="flex items-center gap-3 border-b border-border glass px-4 py-2.5 flex-shrink-0 shadow-sm"
        onContextMenu={handleContextMenu}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground no-touch-target"
          onClick={() => router.push('/chat')}
          title="Назад к списку чатов"
          aria-label="Назад к списку чатов"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <button
          type="button"
          onClick={handleHeaderClick}
          className="flex flex-1 min-w-0 items-center gap-3 text-left"
        >
          <div
            className={cn(
              'flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1.5 pl-1 pr-2 -ml-1 transition-colors duration-150',
              isHeaderClickable && 'hover:bg-muted/50 dark:hover:bg-muted/40 cursor-pointer',
            )}
          >
            <UserAvatar src={avatarUrl} name={title} size="md" />
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm truncate flex items-center gap-1.5">
                {chatType === 'private' ? (
                  <DisplayNameWithBadge
                    name={title}
                    isPremium={isPremium}
                    badgeEmoji={badgeEmoji}
                    isBot={isBot}
                    isVerified={chat?.isVerified}
                    isOfficial={chat?.isOfficial}
                    size="sm"
                    className="min-w-0"
                  />
                ) : (
                  <>
                    {title}
                    {chatType === 'channel' && (
                      <span title="Канал" className="inline-flex flex-shrink-0">
                        <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                    )}
                  </>
                )}
              </h2>
              <AnimatePresence mode="wait">
                <motion.p
                  key={isTyping ? 'typing' : 'status'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs text-muted-foreground truncate"
                >
                  {isTyping && (
                    <span className="inline-flex items-center gap-1">
                      <span className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="h-1 w-1 rounded-full bg-primary"
                            animate={{ y: [0, -3, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }}
                          />
                        ))}
                      </span>
                      {' '}{subtitle}
                    </span>
                  )}
                  {!isTyping && subtitle}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-0.5">
          {chatType === 'private' && !isBot && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-9 w-9"
                onClick={handleVoiceCall}
                title="Звонок"
              >
                <Phone className="h-[18px] w-[18px]" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-9 w-9"
                onClick={handleVideoCall}
                title="Видео"
              >
                <Video className="h-[18px] w-[18px]" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-9 w-9"
            onClick={handleSearch}
            title="Поиск"
          >
            <Search className="h-[18px] w-[18px]" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-9 w-9"
                title="Ещё"
              >
                <MoreVertical className="h-[18px] w-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {contextMenuItems}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      <AnimatePresence>
        {contextMenu && typeof document !== 'undefined' &&
          createPortal(
            <motion.div
              ref={contextMenuRef}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed z-[100] min-w-[12rem] rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenuItems}
            </motion.div>,
            document.body,
          )}
      </AnimatePresence>
    </>
  );
}
