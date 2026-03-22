'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Forward, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useChatStore } from '@/stores/chat-store';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Message } from '@/stores/message-store';

export interface ForwardModalData {
  message: Message;
  fromChatId: string;
}

interface Props {
  open: boolean;
  data: ForwardModalData | null;
  onClose: () => void;
}

export function ForwardDialog({ open, data, onClose }: Props) {
  const chats = useChatStore((s) => s.chats);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const candidates = data
    ? chats.filter((c) => c.id !== data.fromChatId)
    : [];
  const message = data?.message;
  const fromChatId = data?.fromChatId ?? '';

  useEffect(() => {
    if (data?.message?.id) setSelectedIds(new Set());
  }, [data?.message?.id]);

  function toggleChat(chatId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
    setError('');
  }

  async function handleSubmit() {
    if (!data || !message || selectedIds.size === 0) return;
    setSending(true);
    setError('');
    try {
      await api.post(`/messages/${message.id}/forward`, {
        fromChatId,
        toChatIds: Array.from(selectedIds),
      });
      onClose();
      setSelectedIds(new Set());
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Не удалось переслать сообщение'));
    } finally {
      setSending(false);
    }
  }

  const previewText =
    message?.textContent?.slice(0, 80) ??
    (message?.contentType === 'image'
      ? 'Фото'
      : message?.contentType === 'video_note'
        ? 'Видеосообщение'
        : message?.contentType === 'voice'
          ? 'Голосовое сообщение'
          : 'Сообщение');
  const hasSelection = selectedIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-5 w-5 text-primary" />
            Переслать сообщение
          </DialogTitle>
          <DialogDescription className="sr-only">
            Выберите чаты, в которые нужно переслать выбранное сообщение
          </DialogDescription>
        </DialogHeader>

        {message && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Сообщение: </span>
            {previewText}
            {previewText.length >= 80 && '…'}
          </div>
        )}

        <p className="text-xs text-muted-foreground">Выберите чаты для пересылки</p>
        <div className="max-h-[280px] overflow-y-auto rounded-lg border border-border">
          <AnimatePresence mode="wait">
            {candidates.length === 0 ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 text-center text-sm text-muted-foreground"
              >
                Нет других чатов для пересылки
              </motion.p>
            ) : (
              <ul key="list" className="divide-y divide-border">
                {candidates.map((chat) => {
                  const isSelected = selectedIds.has(chat.id);
                  const title = chat.title ?? 'Чат';
                  return (
                    <li key={chat.id}>
                      <button
                        type="button"
                        onClick={() => toggleChat(chat.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                      >
                        <UserAvatar
                          src={chat.avatarUrl}
                          name={title}
                          size="md"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {title}
                        </span>
                        <span
                          className={cn(
                            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/40',
                          )}
                        >
                          {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasSelection || sending}
          >
            {sending ? 'Отправка…' : `Переслать${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
