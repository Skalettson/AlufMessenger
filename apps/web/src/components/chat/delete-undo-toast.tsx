'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2, Trash2 } from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';
import { useChatStore } from '@/stores/chat-store';
import { api } from '@/lib/api';

const UNDO_SECONDS = 7;

function pendingKey(chatId: string, type: 'me' | 'everyone') {
  return `${chatId}:${type}`;
}

export function DeleteUndoToast() {
  const pending = useUiStore((s) => s.pendingChatDelete);
  const clearPending = useUiStore((s) => s.setPendingChatDelete);
  const addChat = useChatStore((s) => s.addChat);
  const [secondsLeft, setSecondsLeft] = useState(UNDO_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmRef = useRef<boolean>(false);
  const previousPendingRef = useRef<typeof pending>(null);
  const confirmedKeysRef = useRef<Set<string>>(new Set());

  async function doConfirmDelete(
    chatId: string,
    type: 'me' | 'everyone',
    chatType: string,
  ) {
    const key = pendingKey(chatId, type);
    if (confirmedKeysRef.current.has(key)) return;
    confirmedKeysRef.current.add(key);
    try {
      if (type === 'everyone') {
        await api.delete(`/chats/${chatId}`);
      } else if (chatType !== 'private') {
        await api.post(`/chats/${chatId}/leave`);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!pending) {
      previousPendingRef.current = null;
      confirmedKeysRef.current.clear();
      setSecondsLeft(UNDO_SECONDS);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (previousPendingRef.current && (previousPendingRef.current.chat.id !== pending.chat.id || previousPendingRef.current.type !== pending.type)) {
      const prev = previousPendingRef.current;
      doConfirmDelete(prev.chat.id, prev.type, prev.chat.type);
    }
    previousPendingRef.current = pending;

    setSecondsLeft(UNDO_SECONDS);
    confirmRef.current = false;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (!confirmRef.current) {
            const chatId = pending.chat.id;
            const type = pending.type;
            const chatType = pending.chat.type;
            doConfirmDelete(chatId, type, chatType);
            setTimeout(() => clearPending(null), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pending?.chat.id, pending?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleUndo() {
    if (!pending) return;
    confirmRef.current = true;
    addChat(pending.chat);
    clearPending(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  if (!pending) return null;

  const label =
    pending.type === 'everyone'
      ? 'Чат удалён для всех'
      : 'Чат удалён из списка';

  return (
    <AnimatePresence>
      <motion.div
        key={`${pending.chat.id}-${pending.type}`}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="fixed bottom-6 right-6 z-[200] w-[320px] overflow-hidden rounded-xl border border-border bg-card shadow-lg"
      >
        <div className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Можно отменить в течение {secondsLeft} сек
              </p>
            </div>
            <motion.button
              type="button"
              onClick={handleUndo}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Отменить
            </motion.button>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: UNDO_SECONDS, ease: 'linear' }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
