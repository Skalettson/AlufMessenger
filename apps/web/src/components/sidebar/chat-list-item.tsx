'use client';

import { motion, useMotionValue, animate, type PanInfo } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useChatStore, type ChatPreview, USER_FOLDERS } from '@/stores/chat-store';
import { usePresenceStore } from '@/stores/presence-store';
import { useUiStore } from '@/stores/ui-store';
import { useMessageStore } from '@/stores/message-store';
import { UserAvatar } from '@/components/shared/user-avatar';
import { MessageTextWithEmoji } from '@/components/message/message-text-with-emoji';
import { formatMessageTime, truncate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { VolumeOff, Pin, Info, Users, BellOff, LogOut, MessageSquare, Trash2, ChevronRight, Bookmark, Eraser, Megaphone, FolderPlus, Archive, ArchiveRestore, MessageCircle } from 'lucide-react';
import { DisplayNameWithBadge } from '@/components/shared/display-name-with-badge';
import { api } from '@/lib/api';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';

const EMPTY_TYPING: { userId: string; username: string }[] = [];

/** Ширина одной колонки действий при свайпе. */
const SWIPE_ACTION_W = 72;
/** Свайп влево: mute | delete | archive */
const SWIPE_LEFT_MAX = SWIPE_ACTION_W * 3;
/** Свайп вправо: unread | pin */
const SWIPE_RIGHT_MAX = SWIPE_ACTION_W * 2;
const SWIPE_SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.85 };
const FLING_V = 520;

interface Props {
  chat: ChatPreview;
}

export function ChatListItem({ chat }: Props) {
  const router = useRouter();
  const swipeSuppressClick = useRef(false);
  const swipeX = useMotionValue(0);
  const [listGestures, setListGestures] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 767px)');
    const apply = () => setListGestures(m.matches);
    apply();
    m.addEventListener('change', apply);
    return () => m.removeEventListener('change', apply);
  }, []);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const removeChat = useChatStore((s) => s.removeChat);
  const updateChat = useChatStore((s) => s.updateChat);
  const addChatToFolder = useChatStore((s) => s.addChatToFolder);
  const removeChatFromFolder = useChatStore((s) => s.removeChatFromFolder);
  const isChatInFolder = useChatStore((s) => s.isChatInFolder);
  const setChatArchived = useChatStore((s) => s.setChatArchived);
  const isChatArchived = useChatStore((s) => s.isChatArchived);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const openModal = useUiStore((s) => s.openModal);
  const setPendingChatDelete = useUiStore((s) => s.setPendingChatDelete);
  const setMessages = useMessageStore((s) => s.setMessages);
  const isActive = activeChatId === chat.id;
  const peerPresence = usePresenceStore((s) => (chat.type === 'private' && chat.otherUserId ? s.byUserId[chat.otherUserId] : undefined));
  const typingUsers = useMessageStore((s) => s.typingUsers[chat.id] ?? EMPTY_TYPING);
  const isTyping = typingUsers.length > 0;
  const isOnline = chat.type === 'private' && chat.otherUserId
    ? (peerPresence?.isOnline ?? false)
    : undefined;

  function handleClick() {
    setActiveChatId(chat.id);
    setSidebarOpen(false);
    router.push(`/chat/${chat.id}`);
  }

  const handleOpen = () => {
    handleClick();
  };
  const handleChatInfo = () => openModal('chat-info', { chatId: chat.id, title: chat.title || 'Чат' });
  const handleToggleMute = async () => {
    try {
      if (chat.isMuted) {
        await api.delete(`/chats/${chat.id}/mute`);
        updateChat(chat.id, { isMuted: false });
      } else {
        await api.post(`/chats/${chat.id}/mute`, {});
        updateChat(chat.id, { isMuted: true });
      }
    } catch {
      // ignore
    }
  };
  const handleTogglePin = async () => {
    try {
      if (chat.isPinned) {
        await api.delete(`/chats/${chat.id}/pin`);
        updateChat(chat.id, { isPinned: false });
      } else {
        await api.post(`/chats/${chat.id}/pin`);
        updateChat(chat.id, { isPinned: true });
      }
    } catch {
      // ignore
    }
  };
  const handleLeaveChat = async () => {
    try {
      await api.post(`/chats/${chat.id}/leave`);
      removeChat(chat.id);
      if (activeChatId === chat.id) router.push('/chat');
    } catch {
      // ignore
    }
  };
  /** Удалить только у себя: скрыть из списка, показать тост с отменой; через 7 сек — вызвать leave для группы/канала */
  const handleDeleteForMe = () => {
    removeChat(chat.id);
    if (activeChatId === chat.id) router.push('/chat');
    setPendingChatDelete({ chat, type: 'me' });
  };
  /** Удалить чат для всех: скрыть из списка, показать тост с отменой; через 7 сек — вызвать DELETE */
  const handleDeleteForEveryone = () => {
    removeChat(chat.id);
    if (activeChatId === chat.id) router.push('/chat');
    setPendingChatDelete({ chat, type: 'everyone' });
  };
  const handleClearSaved = async () => {
    try {
      await api.delete(`/chats/${chat.id}/messages`);
      setMessages(chat.id, []);
      updateChat(chat.id, {
        lastMessageText: null,
        lastMessageSender: null,
        lastMessageAt: null,
      });
    } catch {
      // ignore
    }
  };

  const archived = isChatArchived(chat.id);
  const handleArchive = async () => {
    try {
      await api.post(`/chats/${chat.id}/archive`);
    } catch {
      // ignore
    }
    setChatArchived(chat.id, true);
  };
  const handleUnarchive = async () => {
    try {
      await api.delete(`/chats/${chat.id}/archive`);
    } catch {
      // ignore
    }
    setChatArchived(chat.id, false);
  };

  /** Локально «не прочитан» (серверного mark-unread пока нет). */
  const handleMarkUnread = () => {
    if (chat.unreadCount > 0) return;
    updateChat(chat.id, { unreadCount: 1 });
  };

  const closeSwipe = () => animate(swipeX, 0, SWIPE_SPRING);

  const onSwipeAction = (fn: () => void | Promise<void>) => {
    swipeSuppressClick.current = true;
    void Promise.resolve(fn()).finally(() => {
      void closeSwipe();
      window.setTimeout(() => {
        swipeSuppressClick.current = false;
      }, 320);
    });
  };

  const title = chat.type === 'saved' ? 'Избранное' : (chat.title || 'Чат');
  const isSavedChat = chat.type === 'saved' || title === 'Избранное';
  const preview = isTyping
    ? `${typingUsers.map((u) => u.username || 'Кто-то').join(', ')} печатает...`
    : chat.lastMessageText
      ? (chat.lastMessageSender ? `${chat.lastMessageSender}: ${chat.lastMessageText}` : chat.lastMessageText)
      : 'Нет сообщений';

  const gesturesOn = listGestures && !isSavedChat;

  const snapSwipeEnd = (_: unknown, info: PanInfo) => {
    if (!gesturesOn) return;
    const cx = swipeX.get();
    const vx = info.velocity.x;
    if (vx < -FLING_V) {
      void animate(swipeX, -SWIPE_LEFT_MAX, SWIPE_SPRING);
      return;
    }
    if (vx > FLING_V) {
      void animate(swipeX, SWIPE_RIGHT_MAX, SWIPE_SPRING);
      return;
    }
    if (cx < -SWIPE_LEFT_MAX / 2) void animate(swipeX, -SWIPE_LEFT_MAX, SWIPE_SPRING);
    else if (cx > SWIPE_RIGHT_MAX / 2) void animate(swipeX, SWIPE_RIGHT_MAX, SWIPE_SPRING);
    else void closeSwipe();
  };

  useEffect(() => {
    if (!gesturesOn) void animate(swipeX, 0, SWIPE_SPRING);
  }, [gesturesOn, swipeX]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="relative overflow-hidden rounded-xl">
          {gesturesOn && (
            <div className="absolute inset-y-1 left-1 right-1 z-0 flex select-none justify-between gap-1">
              <div className="flex min-h-0 flex-shrink-0 items-stretch gap-1">
                <button
                  type="button"
                  aria-label="Пометить непрочитанным"
                  className="pointer-events-auto flex min-h-[52px] w-[72px] flex-col items-center justify-center gap-0.5 rounded-xl bg-zinc-700 px-1.5 text-white shadow-sm active:opacity-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwipeAction(() => handleMarkUnread());
                  }}
                >
                  <MessageCircle className="h-5 w-5 shrink-0" strokeWidth={2} />
                  <span className="max-w-[68px] text-center text-[10px] font-medium leading-tight">Не прочитан</span>
                </button>
                <button
                  type="button"
                  aria-label={chat.isPinned ? 'Открепить чат' : 'Закрепить чат'}
                  className="pointer-events-auto flex min-h-[52px] w-[72px] flex-col items-center justify-center gap-0.5 rounded-xl bg-emerald-600 px-1.5 text-white shadow-sm active:opacity-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwipeAction(() => handleTogglePin());
                  }}
                >
                  <Pin className="h-5 w-5 shrink-0" strokeWidth={2} />
                  <span className="max-w-[68px] text-center text-[10px] font-medium leading-tight">
                    {chat.isPinned ? 'Открепить' : 'Закрепить'}
                  </span>
                </button>
              </div>
              <div className="flex min-h-0 flex-shrink-0 items-stretch gap-1">
                <button
                  type="button"
                  aria-label={chat.isMuted ? 'Включить звук' : 'Отключить звук'}
                  className="pointer-events-auto flex min-h-[52px] w-[72px] flex-col items-center justify-center gap-0.5 rounded-xl bg-amber-500 px-1.5 text-white shadow-sm active:opacity-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwipeAction(() => handleToggleMute());
                  }}
                >
                  <BellOff className="h-5 w-5 shrink-0" strokeWidth={2} />
                  <span className="max-w-[68px] text-center text-[10px] font-medium leading-tight">
                    {chat.isMuted ? 'Вкл. звук' : 'Убрать звук'}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Удалить чат у себя"
                  className="pointer-events-auto flex min-h-[52px] w-[72px] flex-col items-center justify-center gap-0.5 rounded-xl bg-red-600 px-1.5 text-white shadow-sm active:opacity-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwipeAction(() => handleDeleteForMe());
                  }}
                >
                  <Trash2 className="h-5 w-5 shrink-0" strokeWidth={2} />
                  <span className="max-w-[68px] text-center text-[10px] font-medium leading-tight">Удалить</span>
                </button>
                <button
                  type="button"
                  aria-label={archived ? 'Извлечь из архива' : 'В архив'}
                  className="pointer-events-auto flex min-h-[52px] w-[72px] flex-col items-center justify-center gap-0.5 rounded-xl bg-zinc-600 px-1.5 text-white shadow-sm active:opacity-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwipeAction(() => (archived ? handleUnarchive() : handleArchive()));
                  }}
                >
                  {archived ? (
                    <ArchiveRestore className="h-5 w-5 shrink-0" strokeWidth={2} />
                  ) : (
                    <Archive className="h-5 w-5 shrink-0" strokeWidth={2} />
                  )}
                  <span className="max-w-[68px] text-center text-[10px] font-medium leading-tight">
                    {archived ? 'Из архива' : 'В архив'}
                  </span>
                </button>
              </div>
            </div>
          )}
          <motion.button
            type="button"
            style={{ x: swipeX }}
            onClick={(e) => {
              if (swipeSuppressClick.current) {
                e.preventDefault();
                swipeSuppressClick.current = false;
                return;
              }
              if (gesturesOn && Math.abs(swipeX.get()) > 12) {
                e.preventDefault();
                void closeSwipe();
                return;
              }
              handleClick();
            }}
            whileHover={{ backgroundColor: isActive ? undefined : 'var(--color-sidebar-hover)' }}
            whileTap={{ scale: 0.97, transition: { duration: 0.1 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
              'touch-interactive relative z-10 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150',
              isActive ? 'bg-primary/10 shadow-sm' : 'bg-sidebar hover:shadow-sm',
            )}
            drag={gesturesOn ? 'x' : false}
            dragConstraints={{ left: -SWIPE_LEFT_MAX, right: SWIPE_RIGHT_MAX }}
            dragElastic={0.12}
            dragMomentum={false}
            onDragEnd={snapSwipeEnd}
          >
            <UserAvatar src={chat.avatarUrl} name={title} size="lg" isOnline={isOnline} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={cn('font-semibold text-sm truncate flex items-center gap-1.5 min-w-0', isActive && 'text-primary')}>
                  <DisplayNameWithBadge
                    name={title}
                    isPremium={chat.type === 'private' ? chat.isPremium : undefined}
                    badgeEmoji={chat.type === 'private' ? chat.premiumBadgeEmoji : undefined}
                    isBot={chat.type === 'private' ? chat.isBot : undefined}
                    isVerified={chat.type === 'private' ? chat.isVerified : undefined}
                    isOfficial={chat.type === 'private' ? chat.isOfficial : undefined}
                    size="sm"
                    className="min-w-0"
                  />
                  {isSavedChat && (
                    <span title="Избранное" className="inline-flex flex-shrink-0">
                      <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  )}
                  {chat.type === 'channel' && (
                    <span title="Канал" className="inline-flex flex-shrink-0">
                      <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">
                  {chat.lastMessageAt && formatMessageTime(chat.lastMessageAt)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5 min-w-0">
                <span
                  className={cn(
                    'text-[13px] truncate leading-snug',
                    isTyping ? 'text-primary italic' : 'text-muted-foreground',
                  )}
                >
                  {isTyping || !chat.lastMessageText ? (
                    truncate(preview, 40)
                  ) : (
                    <MessageTextWithEmoji
                      text={truncate(preview, 40)}
                      emojiSize={14}
                      className="whitespace-nowrap truncate inline-block max-w-full align-middle"
                    />
                  )}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {chat.isMuted && <VolumeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  {chat.isPinned && <Pin className="h-3.5 w-3.5 text-muted-foreground" />}
                  {chat.unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      className={cn(
                        'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
                        chat.isMuted ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground',
                      )}
                    >
                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                    </motion.span>
                  )}
                </div>
              </div>
            </div>
          </motion.button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleOpen} className="gap-2 cursor-pointer">
          <MessageSquare className="h-4 w-4" /> Открыть
        </ContextMenuItem>
        <ContextMenuItem onClick={handleChatInfo} className="gap-2 cursor-pointer">
          <Info className="h-4 w-4" /> Информация о чате
        </ContextMenuItem>
        {!isSavedChat && (
          <ContextMenuItem onClick={handleTogglePin} className="gap-2 cursor-pointer">
            <Pin className="h-4 w-4" />
            {chat.isPinned ? 'Открепить чат' : 'Закрепить чат'}
          </ContextMenuItem>
        )}
        {chat.type !== 'private' && chat.type !== 'saved' && (
          <ContextMenuItem onClick={handleChatInfo} className="gap-2 cursor-pointer">
            <Users className="h-4 w-4" /> Участники
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={handleToggleMute} className="gap-2 cursor-pointer text-muted-foreground">
          <BellOff className="h-4 w-4" /> {chat.isMuted ? 'Включить уведомления' : 'Отключить уведомления'}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2 cursor-pointer">
            <FolderPlus className="h-4 w-4" /> Добавить в папку
            <ChevronRight className="ml-auto h-4 w-4" />
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {USER_FOLDERS.map((folder) => {
              const inFolder = isChatInFolder(chat.id, folder.id);
              return (
                <ContextMenuItem
                  key={folder.id}
                  onClick={() => (inFolder ? removeChatFromFolder(chat.id, folder.id) : addChatToFolder(chat.id, folder.id))}
                  className="gap-2 cursor-pointer"
                >
                  {inFolder ? `Убрать из «${folder.name}»` : folder.name}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
        {archived ? (
          <ContextMenuItem onClick={handleUnarchive} className="gap-2 cursor-pointer">
            <ArchiveRestore className="h-4 w-4" /> Извлечь из архива
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={handleArchive} className="gap-2 cursor-pointer">
            <Archive className="h-4 w-4" /> Архивировать
          </ContextMenuItem>
        )}
        {isSavedChat && (
          <ContextMenuItem onClick={handleClearSaved} className="gap-2 cursor-pointer text-muted-foreground">
            <Eraser className="h-4 w-4" /> Очистить
          </ContextMenuItem>
        )}
        {chat.type !== 'private' && chat.type !== 'saved' && (
          <ContextMenuItem onClick={handleLeaveChat} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" /> Покинуть чат
          </ContextMenuItem>
        )}
        {!isSavedChat && (
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2 cursor-pointer text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4" /> Удалить чат
            <ChevronRight className="ml-auto h-4 w-4" />
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={handleDeleteForMe} className="gap-2 cursor-pointer">
              Только у меня
            </ContextMenuItem>
            <ContextMenuItem onClick={handleDeleteForEveryone} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
              У всех
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
