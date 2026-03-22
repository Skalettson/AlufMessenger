'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMessages } from '@/hooks/use-messages';
import { MessageBubble } from '@/components/message/message-bubble';
import { MessageContextMenu } from '@/components/message/message-context-menu';
import { SwipeableMessage } from '@/components/message/swipeable-message';
import { formatChatDate } from '@/lib/utils';
import { useChatStore } from '@/stores/chat-store';

interface Props {
  chatId: string;
  /** Тип чата (channel, group, private и т.д.) — для текста пустого состояния и отображения постов. */
  chatType?: string;
  /** Чат «Избранное» — все сообщения отображаются как свои (заметки). */
  isSavedChat?: boolean;
  /** Название канала (для отображения постов как «от канала»). */
  channelTitle?: string | null;
  /** Аватар канала. */
  channelAvatarUrl?: string | null;
  /** Имя собеседника в личном чате (для подстановки в сообщения без senderName). */
  otherParticipantName?: string | null;
  /** Аватар собеседника в личном чате. */
  otherParticipantAvatar?: string | null;
  /** Premium-статус собеседника в личном чате. */
  otherParticipantIsPremium?: boolean;
}

export function MessageList({ chatId, chatType, isSavedChat, channelTitle, channelAvatarUrl, otherParticipantName, otherParticipantAvatar, otherParticipantIsPremium }: Props) {
  const { messages, typingUsers } = useMessages(chatId, { isSavedChat });
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMsgLenRef = useRef(messages.length);
  const chatOpenedAtRef = useRef(0);
  const pendingScrollToMessageId = useChatStore((s) => s.pendingScrollToMessageId);
  const setPendingScrollToMessageId = useChatStore((s) => s.setPendingScrollToMessageId);

  /** Смена чата: сразу вниз */
  useLayoutEffect(() => {
    chatOpenedAtRef.current = Date.now();
    prevMsgLenRef.current = 0;
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, [chatId]);

  /** Новые сообщения: вниз, если у низа или первая загрузка истории */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevLen = prevMsgLenRef.current;
    if (messages.length === prevLen) return;
    const grew = messages.length > prevLen;
    prevMsgLenRef.current = messages.length;
    if (!grew) return;
    const quickAfterOpen = Date.now() - chatOpenedAtRef.current < 4000;
    const initialBatch = quickAfterOpen && prevLen === 0;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (initialBatch || nearBottom) {
      bottomRef.current?.scrollIntoView({
        block: 'end',
        behavior: initialBatch ? 'auto' : 'smooth',
      });
    }
  }, [messages.length, chatId]);

  useEffect(() => {
    if (typingUsers.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }, [typingUsers.length]);

  /** Поиск по чату: прокрутка к найденному сообщению */
  useEffect(() => {
    if (!pendingScrollToMessageId || pendingScrollToMessageId === '') return;
    const safeId =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(pendingScrollToMessageId)
        : pendingScrollToMessageId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-message-id="${safeId}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('ring-2', 'ring-primary/60', 'rounded-lg');
      const t = window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-primary/60', 'rounded-lg');
      }, 2000);
      setPendingScrollToMessageId(null);
      return () => window.clearTimeout(t);
    }
    setPendingScrollToMessageId(null);
  }, [pendingScrollToMessageId, messages, setPendingScrollToMessageId]);

  const emptyMessage =
    chatType === 'channel'
      ? 'В канале пока нет сообщений'
      : chatType === 'group' || chatType === 'secret'
        ? 'В группе пока нет сообщений'
        : 'Нет сообщений. Начните диалог!';

  let lastDate = '';

  return (
    <div
      ref={containerRef}
      className="chat-scroll-area min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 [-webkit-overflow-scrolling:touch]"
    >
      {messages.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex h-full items-center justify-center text-muted-foreground text-sm"
        >
          {emptyMessage}
        </motion.div>
      )}
      {messages.map((msg) => {
        const msgDate = formatChatDate(msg.createdAt);
        const showDate = msgDate !== lastDate;
        lastDate = msgDate;
        return (
          <motion.div
            key={msg.id}
            data-message-id={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            {showDate && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="flex justify-center my-3"
              >
                <span className="rounded-full bg-black/10 dark:bg-white/20 px-3 py-1 text-xs text-foreground/80 dark:text-white/85 backdrop-blur-sm">
                  {msgDate}
                </span>
              </motion.div>
            )}
            <MessageContextMenu message={msg} chatId={chatId} canPin={true}>
              <SwipeableMessage message={msg}>
                <MessageBubble
                  message={msg}
                  isChannel={chatType === 'channel'}
                  channelTitle={channelTitle}
                  channelAvatarUrl={channelAvatarUrl}
                  fallbackSenderName={otherParticipantName}
                  fallbackSenderAvatar={otherParticipantAvatar}
                  fallbackSenderIsPremium={otherParticipantIsPremium}
                />
              </SwipeableMessage>
            </MessageContextMenu>
          </motion.div>
        );
      })}
      <AnimatePresence>
        {chatType !== 'channel' && typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
          >
            <span className="flex gap-0.5 items-center">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </span>
            <span>{typingUsers.map((u) => u.username).join(', ')} печатает...</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
