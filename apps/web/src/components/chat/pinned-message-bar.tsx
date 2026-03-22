'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, X, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PinnedMessage {
  id: string;
  textContent: string | null;
  senderDisplayName: string;
  contentType?: number | string;
}

interface Props {
  chatId: string;
  onScrollToMessage?: (messageId: string) => void;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  image: 'Фото',
  video: 'Видео',
  audio: 'Аудио',
  voice: 'Голосовое сообщение',
  video_note: 'Видеосообщение',
  document: 'Документ',
  sticker: 'Стикер',
};

function getPreviewText(msg: PinnedMessage): string {
  if (msg.textContent?.trim()) return msg.textContent.trim();
  const ct = typeof msg.contentType === 'string' ? msg.contentType : '';
  return CONTENT_TYPE_LABELS[ct] ?? 'Сообщение';
}

export function PinnedMessageBar({ chatId, onScrollToMessage }: Props) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const fetchPinned = useCallback(async () => {
    try {
      const res = await api.get<{ messages?: PinnedMessage[] }>(`/chats/${chatId}/pinned`);
      const msgs = Array.isArray(res?.messages) ? res.messages : [];
      const normalized = msgs.map((m: any) => ({
        id: String(m.id ?? ''),
        textContent: m.textContent ?? m.text_content ?? null,
        senderDisplayName: m.senderDisplayName ?? m.sender_display_name ?? '',
        contentType: m.contentType ?? m.content_type ?? 'text',
      }));
      setPinnedMessages(normalized);
      setCurrentIndex(0);
      setDismissed(false);
    } catch {
      setPinnedMessages([]);
    }
  }, [chatId]);

  useEffect(() => {
    fetchPinned();
  }, [fetchPinned]);

  const current = pinnedMessages[currentIndex];

  if (dismissed || !current || pinnedMessages.length === 0) return null;

  const handleClick = () => {
    onScrollToMessage?.(current.id);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((i) => (i > 0 ? i - 1 : pinnedMessages.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((i) => (i < pinnedMessages.length - 1 ? i + 1 : 0));
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="border-b border-border bg-background/95 backdrop-blur-sm cursor-pointer"
        onClick={handleClick}
      >
        <div className="flex items-center gap-2 px-4 py-2">
          <Pin className="h-4 w-4 text-primary shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-primary">
                Закреплённое сообщение
                {pinnedMessages.length > 1 && (
                  <span className="text-muted-foreground font-normal ml-1">
                    {currentIndex + 1}/{pinnedMessages.length}
                  </span>
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {getPreviewText(current)}
            </p>
          </div>

          {pinnedMessages.length > 1 && (
            <div className="flex flex-col shrink-0">
              <button
                type="button"
                onClick={handlePrev}
                className="p-0.5 hover:bg-muted rounded transition-colors"
              >
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-0.5 hover:bg-muted rounded transition-colors"
              >
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className={cn(
              'p-1 rounded-full hover:bg-muted transition-colors shrink-0',
              'text-muted-foreground hover:text-foreground',
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
