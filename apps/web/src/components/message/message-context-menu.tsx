'use client';

import React from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { Reply, Forward, Copy, Pencil, Trash2, Pin, PinOff } from 'lucide-react';
import { type Message } from '@/stores/message-store';
import { useMessageStore } from '@/stores/message-store';
import { useUiStore } from '@/stores/ui-store';
import { api, getErrorMessage } from '@/lib/api';
import { useMyCustomEmoji } from '@/hooks/use-custom-emoji';
import { useMediaUrlWithType } from '@/hooks/use-media-url';
import { MediaImageOrVideo } from '@/components/shared/media-image-or-video';

interface Props {
  message: Message;
  chatId: string;
  canPin?: boolean;
  children: React.ReactNode;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
/** Реакция по двойному клику по сообщению (самая частая по умолчанию). */
const DEFAULT_DOUBLE_CLICK_REACTION = QUICK_REACTIONS[0];

function CustomEmojiReactionThumb({ mediaId, shortcode }: { mediaId: string; shortcode: string }) {
  const { url, mimeType } = useMediaUrlWithType(mediaId);
  if (!url) return <span className="w-5 h-5 rounded bg-secondary/50 inline-block" />;
  return <MediaImageOrVideo url={url} mimeType={mimeType} alt={shortcode} className="w-5 h-5" />;
}

export function MessageContextMenu({ message, chatId, canPin = true, children }: Props) {
  const setReplyingTo = useMessageStore((s) => s.setReplyingTo);
  const { data: myCustomEmoji = [] } = useMyCustomEmoji();
  const setEditingMessage = useMessageStore((s) => s.setEditingMessage);
  const updateMessage = useMessageStore((s) => s.updateMessage);
  const removeMessage = useMessageStore((s) => s.removeMessage);
  const openModal = useUiStore((s) => s.openModal);

  const canEdit =
    message.isMine &&
    message.contentType === 'text' &&
    !!message.textContent &&
    !message.forwardFrom;
  const canCopy = !!message.textContent;
  const isPinned = message.isPinned;

  const handleReply = () => setReplyingTo(message);
  const handleForward = () => openModal('forward', { message, fromChatId: chatId });
  const handleCopy = () => {
    if (message.textContent && navigator.clipboard) {
      navigator.clipboard.writeText(message.textContent);
    }
  };
  const handleEdit = () => setEditingMessage(message);

  function toErrorString(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    return getErrorMessage(err);
  }

  const handleDelete = async (forEveryone: boolean) => {
    try {
      await api.delete(`/messages/${message.id}?chatId=${encodeURIComponent(chatId)}&deleteForEveryone=${forEveryone}`);
      removeMessage(chatId, message.id);
    } catch (err) {
      console.error(toErrorString(err));
    }
  };

  const handlePin = async () => {
    try {
      await api.post(`/messages/${message.id}/pin?chatId=${encodeURIComponent(chatId)}`);
      updateMessage(chatId, message.id, { isPinned: true });
    } catch (err) {
      console.error(toErrorString(err));
    }
  };

  const handleUnpin = async () => {
    try {
      await api.delete(`/messages/${message.id}/pin?chatId=${encodeURIComponent(chatId)}`);
      updateMessage(chatId, message.id, { isPinned: false });
    } catch (err) {
      console.error(toErrorString(err));
    }
  };

  const handleReact = async (emoji: string) => {
    const prev = message.reactions ?? [];
    const existing = prev.find((r) => r.emoji === emoji);
    let optimistic: Message['reactions'];
    if (existing?.reacted) {
      optimistic = existing.count <= 1
        ? prev.filter((r) => r.emoji !== emoji)
        : prev.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r);
    } else if (existing) {
      optimistic = prev.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r);
    } else {
      optimistic = [...prev, { emoji, count: 1, reacted: true }];
    }
    updateMessage(chatId, message.id, { reactions: optimistic });
    try {
      await api.post(`/messages/${message.id}/react?chatId=${encodeURIComponent(chatId)}`, { emoji });
    } catch (err) {
      updateMessage(chatId, message.id, { reactions: prev });
      console.error(toErrorString(err));
    }
  };

  const handleDoubleClick = () => {
    handleReact(DEFAULT_DOUBLE_CLICK_REACTION);
  };

  const triggerChild = React.Children.only(children);
  const childWithDoubleClick =
    React.isValidElement(triggerChild)
      ? React.cloneElement(triggerChild, {
          onDoubleClick: (e: React.MouseEvent) => {
            (triggerChild.props as { onDoubleClick?: (e: React.MouseEvent) => void }).onDoubleClick?.(e);
            handleDoubleClick();
          },
        } as { onDoubleClick?: (e: React.MouseEvent) => void })
      : children;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* не display:contents — у триггера должна быть геометрия для позиционирования меню на тач-устройствах */}
        <div className="min-w-0 w-full max-w-full">{childWithDoubleClick}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleReply} className="cursor-pointer">
          <Reply className="mr-2 h-4 w-4" />
          Ответить
        </ContextMenuItem>
        <ContextMenuItem onClick={handleForward} className="cursor-pointer">
          <Forward className="mr-2 h-4 w-4" />
          Переслать
        </ContextMenuItem>
        {canCopy && (
          <ContextMenuItem onClick={handleCopy} className="cursor-pointer">
            <Copy className="mr-2 h-4 w-4" />
            Копировать
          </ContextMenuItem>
        )}
        {canEdit && (
          <ContextMenuItem onClick={handleEdit} className="cursor-pointer">
            <Pencil className="mr-2 h-4 w-4" />
            Редактировать
          </ContextMenuItem>
        )}
        {canPin && (
          isPinned ? (
            <ContextMenuItem onClick={handleUnpin} className="cursor-pointer">
              <PinOff className="mr-2 h-4 w-4" />
              Открепить
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={handlePin} className="cursor-pointer">
              <Pin className="mr-2 h-4 w-4" />
              Закрепить
            </ContextMenuItem>
          )
        )}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="cursor-pointer">
            <span className="mr-2">👍</span>
            Реакция
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {QUICK_REACTIONS.map((emoji) => (
              <ContextMenuItem key={emoji} onClick={() => handleReact(emoji)} className="cursor-pointer text-lg">
                {emoji}
              </ContextMenuItem>
            ))}
            {myCustomEmoji.length > 0 && (
              <>
                <ContextMenuSeparator />
                {myCustomEmoji.slice(0, 12).map((e) => (
                  <ContextMenuItem key={e.id} onClick={() => handleReact(e.shortcode)} className="cursor-pointer flex items-center gap-2">
                    <CustomEmojiReactionThumb mediaId={e.mediaId} shortcode={e.shortcode} />
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">{e.shortcode}</span>
                  </ContextMenuItem>
                ))}
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        {message.isMine && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger className="cursor-pointer text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem onClick={() => handleDelete(false)} className="cursor-pointer">
                  Удалить у себя
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleDelete(true)} className="cursor-pointer text-destructive focus:text-destructive">
                  Удалить у всех
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
