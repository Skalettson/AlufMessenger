'use client';

import { motion } from 'framer-motion';
import { useChats } from '@/hooks/use-chats';
import { useChatStore } from '@/stores/chat-store';
import { ChatListItem } from './chat-list-item';
import { MessageCircle } from 'lucide-react';

function ShimmerRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
      <div className="h-12 w-12 rounded-full shimmer flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-28 rounded-md shimmer" />
        <div className="h-3 w-44 rounded-md shimmer" />
      </div>
    </div>
  );
}

export function ChatList() {
  const { isLoading } = useChats();
  const chats = useChatStore((s) => s.chats);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const activeFolder = useChatStore((s) => s.activeFolder);
  const chatFolderIds = useChatStore((s) => s.chatFolderIds);
  const archivedChatIds = useChatStore((s) => s.archivedChatIds);

  const filtered = chats
    .filter((chat) => {
      const isArchived = !!archivedChatIds[chat.id];
      if (activeFolder === 'archive') {
        if (!isArchived) return false;
      } else {
        if (isArchived) return false;
        if (activeFolder === 'personal') {
          const inPersonal = (chatFolderIds[chat.id] ?? []).includes('personal');
          if (!inPersonal) return false;
        }
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return chat.title?.toLowerCase().includes(q) || chat.lastMessageText?.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const at = new Date(a.lastMessageAt || 0).getTime();
      const bt = new Date(b.lastMessageAt || 0).getTime();
      return bt - at;
    });

  if (isLoading) {
    return (
      <div className="space-y-1 p-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <ShimmerRow key={i} />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    const emptyMessage =
      searchQuery
        ? 'Ничего не найдено'
        : activeFolder === 'archive'
          ? 'В архиве пусто'
          : activeFolder === 'personal'
            ? 'В папке «Личное» пока нет чатов'
            : 'Нет чатов';
    const emptyHint =
      searchQuery
        ? 'Попробуйте другой запрос'
        : activeFolder === 'archive'
          ? 'Архивированные чаты появятся здесь'
          : activeFolder === 'personal'
            ? 'Добавьте чаты через контекстное меню'
            : 'Начните новый разговор';
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 text-muted-foreground"
      >
        <div className="h-16 w-16 rounded-2xl bg-secondary/80 flex items-center justify-center mb-3">
          <MessageCircle className="h-8 w-8 text-muted" />
        </div>
        <p className="text-sm font-medium">{emptyMessage}</p>
        <p className="text-xs text-muted mt-1">{emptyHint}</p>
      </motion.div>
    );
  }

  const pinnedChats = filtered.filter((c) => c.isPinned);
  const otherChats = filtered.filter((c) => !c.isPinned);

  const listVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.04,
        staggerDirection: 1,
      },
    },
  };
  const itemVariants = {
    hidden: { opacity: 0, x: -16 },
    show: {
      opacity: 1,
      x: 0,
      transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={listVariants}
      className="space-y-0.5 p-1"
    >
      {pinnedChats.length > 0 && (
        <motion.div
          className="px-2 pt-1 pb-0.5"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Закреплённые
          </span>
        </motion.div>
      )}
      {pinnedChats.map((chat) => (
        <motion.div key={chat.id} variants={itemVariants}>
          <ChatListItem chat={chat} />
        </motion.div>
      ))}
      {pinnedChats.length > 0 && otherChats.length > 0 && (
        <motion.div
          className="px-2 pt-2 pb-0.5"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Все чаты
          </span>
        </motion.div>
      )}
      {otherChats.map((chat) => (
        <motion.div key={chat.id} variants={itemVariants}>
          <ChatListItem chat={chat} />
        </motion.div>
      ))}
    </motion.div>
  );
}
