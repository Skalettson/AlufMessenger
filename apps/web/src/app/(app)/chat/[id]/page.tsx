'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
import { apiChatToPreview, pickApiAvatarUrl, pickApiUserId, type ApiChat } from '@/lib/chat-mappers';
import { ChatHeader } from '@/components/chat/chat-header';
import { PinnedMessageBar } from '@/components/chat/pinned-message-bar';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { PageTransition } from '@/components/motion/page-transition';

interface ChatMember {
  userId?: string;
  user_id?: string;
  displayName?: string;
  display_name?: string;
  avatarUrl?: string;
  avatar_url?: string;
  isBot?: boolean;
  is_bot?: boolean;
  isPremium?: boolean;
  is_premium?: boolean;
  premiumBadgeEmoji?: string | null;
  premium_badge_emoji?: string | null;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.id as string;
  const [swipeBackEnabled, setSwipeBackEnabled] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const addChat = useChatStore((s) => s.addChat);
  const updateChat = useChatStore((s) => s.updateChat);
  const chats = useChatStore((s) => s.chats);
  const chat = chats.find((c) => c.id === chatId);
  const [privateChatTitle, setPrivateChatTitle] = useState<string | null>(null);
  const [privateChatAvatar, setPrivateChatAvatar] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [botCommands, setBotCommands] = useState<{ command: string; description: string }[]>([]);

  useEffect(() => {
    setActiveChatId(chatId);
    return () => setActiveChatId(null);
  }, [chatId, setActiveChatId]);

  useEffect(() => {
    const m = window.matchMedia('(max-width: 767px)');
    const apply = () => setSwipeBackEnabled(m.matches);
    apply();
    m.addEventListener('change', apply);
    return () => m.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!chatId) return;
    const hasChat = useChatStore.getState().chats.some((c) => c.id === chatId);
    if (hasChat) return;
    let cancelled = false;
    api
      .get<ApiChat>(`/chats/${chatId}`)
      .then((data) => {
        if (!cancelled) addChat(apiChatToPreview(data));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chatId, addChat]);

  useEffect(() => {
    if (!chatId || !currentUserId || !chat) return;
    if (chat.type !== 'private') {
      setProfileUserId(null);
      setPrivateChatTitle(null);
      setPrivateChatAvatar(null);
      return;
    }
    let cancelled = false;
    api
      .get<{ members: ChatMember[] }>(`/chats/${chatId}/members`)
      .then((res) => {
        if (cancelled) return;
        const other = res.members?.find((m) => pickApiUserId(m) && pickApiUserId(m) !== currentUserId);
        if (other) {
          const name = (other.displayName ?? other.display_name ?? '').trim() || 'Пользователь';
          const av = pickApiAvatarUrl(other);
          setPrivateChatTitle(name);
          setPrivateChatAvatar(av);
          setProfileUserId(pickApiUserId(other));
          const badgeStr = String(other.premiumBadgeEmoji ?? other.premium_badge_emoji ?? '').trim();
          const badge = badgeStr || null;
          updateChat(chatId, {
            title: name,
            avatarUrl: av,
            isBot: other.isBot ?? other.is_bot ?? false,
            isPremium: other.isPremium ?? other.is_premium ?? false,
            premiumBadgeEmoji: badge,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chatId, currentUserId, chat?.type, updateChat]);

  useEffect(() => {
    if (!profileUserId || !chat?.isBot) {
      setBotCommands([]);
      return;
    }
    let cancelled = false;
    api
      .get<{ bot_commands?: { command: string; description: string }[]; botCommands?: { command: string; description: string }[] }>(`/users/profile/${profileUserId}`)
      .then((data) => {
        if (cancelled) return;
        const list = data?.bot_commands ?? data?.botCommands ?? [];
        setBotCommands(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setBotCommands([]);
      });
    return () => { cancelled = true; };
  }, [profileUserId, chat?.isBot]);

  const displayTitle =
    chat?.type === 'saved' ? 'Избранное' : (chat?.title || privateChatTitle || 'Чат');
  const displayAvatar = chat?.avatarUrl ?? privateChatAvatar ?? null;
  const isBot = chat?.isBot ?? false;
  const savedChatInList = chats.find((c) => c.type === 'saved');
  const isSavedChat = chat?.type === 'saved' || (savedChatInList?.id === chatId);

  return (
    <PageTransition>
    {/*
      Важно: не помещать поле ввода внутрь motion.div с drag — transform у предка ломает
      position:fixed/sticky и даёт баг iOS (панель «улетает» наверх при открытой клавиатуре).
    */}
    <div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-chat-root
    >
      <motion.div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        drag={swipeBackEnabled ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        onDragEnd={(_, info) => {
          if (swipeBackEnabled && info.offset.x > 56) {
            router.push('/chat');
          }
        }}
      >
        <ChatHeader
          title={displayTitle}
          avatarUrl={displayAvatar}
          memberCount={chat?.memberCount ?? 0}
          chatType={isSavedChat ? 'saved' : (chat ? chat.type : undefined)}
          chatId={chatId}
          isBot={isBot}
          isPremium={chat?.type === 'private' ? chat?.isPremium : undefined}
          badgeEmoji={chat?.type === 'private' ? chat?.premiumBadgeEmoji : undefined}
          profileUserId={profileUserId}
        />
        <PinnedMessageBar chatId={chatId} />
        <MessageList
          chatId={chatId}
          chatType={chat?.type}
          isSavedChat={isSavedChat}
          channelTitle={chat?.type === 'channel' ? (chat?.title ?? null) : undefined}
          channelAvatarUrl={chat?.type === 'channel' ? (chat?.avatarUrl ?? null) : undefined}
          otherParticipantName={chat?.type === 'private' ? (displayTitle !== 'Чат' ? displayTitle : null) : null}
          otherParticipantAvatar={chat?.type === 'private' ? displayAvatar : null}
          otherParticipantIsPremium={chat?.type === 'private' ? chat?.isPremium : undefined}
        />
      </motion.div>
      <MessageInput chatId={chatId} botCommands={botCommands} />
    </div>
    </PageTransition>
  );
}
