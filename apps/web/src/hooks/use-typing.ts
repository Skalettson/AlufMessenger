'use client';
import { useCallback, useRef } from 'react';
import { wsClient } from '@/lib/ws';

export function useTyping(chatId: string | null) {
  const typingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTyping = useCallback(() => {
    if (!chatId || typingRef.current) return;
    typingRef.current = true;
    wsClient.send('typing.start', { chatId });
    timerRef.current = setTimeout(() => {
      typingRef.current = false;
    }, 4000);
  }, [chatId]);

  const stopTyping = useCallback(() => {
    if (!chatId || !typingRef.current) return;
    typingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    wsClient.send('typing.stop', { chatId });
  }, [chatId]);

  return { startTyping, stopTyping };
}
