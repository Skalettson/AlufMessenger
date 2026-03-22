'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { type Message } from '@/stores/message-store';
import { cn, formatMessageTime, pickMediaUrl } from '@/lib/utils';
import { Check, CheckCheck, Clock, AlertCircle, Reply, Forward, FileText, Play, Eye } from 'lucide-react';
import { UserAvatar } from '@/components/shared/user-avatar';
import { DisplayNameWithBadge } from '@/components/shared/display-name-with-badge';
import { useMessageStore } from '@/stores/message-store';
import { useUiStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { useMediaUrl, useMediaUrlWithType } from '@/hooks/use-media-url';
import { MediaImageOrVideo } from '@/components/shared/media-image-or-video';
import { VoiceMessagePlayer } from './voice-message-player';
import { AudioPlayer } from '@/components/media/audio-player';
import { VideoNotePlayer } from '@/components/media/video-note-player';
import { MessageTextWithEmoji } from './message-text-with-emoji';
import { CustomEmojiInline } from '@/components/shared/custom-emoji-inline';
import { StickerPackPreviewModal } from './sticker-pack-preview-modal';
import { isStoryPreviewMediaDuplicate } from '@/lib/story-message-meta';

function ImageThumbnail({ url, mediaId, onClick }: { url: string | null; mediaId?: string | null; onClick: () => void }) {
  const proxiedUrl = useMediaUrl(mediaId ?? null);
  const src = pickMediaUrl(proxiedUrl, url, !!mediaId);
  if (!src) return <span className="text-xs text-muted-foreground">Загрузка...</span>;
  return (
    <button type="button" onClick={onClick} className="block rounded-lg overflow-hidden max-w-[180px] max-h-[140px] focus:outline-none focus:ring-2 focus:ring-primary/50">
      <img src={src} alt="" className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity" loading="lazy" />
    </button>
  );
}

function VideoThumbnail({ url, mediaId, onClick }: { url: string | null; mediaId?: string | null; onClick: () => void }) {
  const proxiedUrl = useMediaUrl(mediaId ?? null);
  const src = pickMediaUrl(proxiedUrl, url, !!mediaId);
  if (!src) return <span className="text-xs text-muted-foreground">Загрузка...</span>;
  return (
    <button type="button" onClick={onClick} className="block rounded-lg overflow-hidden max-w-[180px] max-h-[140px] relative focus:outline-none focus:ring-2 focus:ring-primary/50 bg-black/10">
      <video src={src} muted className="w-full h-full object-cover pointer-events-none" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors">
        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          <Play className="h-5 w-5 text-primary ml-0.5 fill-current" />
        </div>
      </div>
    </button>
  );
}


function DocumentLink({ url, mediaId, fileName }: { url: string | null; mediaId?: string | null; fileName?: string }) {
  const proxiedUrl = useMediaUrl(mediaId ?? null);
  const href = pickMediaUrl(proxiedUrl, url, !!mediaId);
  if (!href) return <span className="text-xs text-muted-foreground">Загрузка...</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-sm"
    >
      <FileText className="h-5 w-5 flex-shrink-0" />
      <span className="truncate max-w-[200px]">{fileName || 'Документ'}</span>
    </a>
  );
}

function StickerThumbnail({
  url,
  mediaId,
  onClick,
}: {
  url: string | null;
  mediaId?: string | null;
  onClick?: () => void;
}) {
  const { url: proxiedUrl, mimeType } = useMediaUrlWithType(mediaId ?? null);
  const src = pickMediaUrl(proxiedUrl, url, !!mediaId);
  if (!src) return <span className="text-xs text-muted-foreground">Загрузка...</span>;
  const content = (
    <MediaImageOrVideo
      url={src}
      mimeType={mimeType}
      className="max-h-[120px] max-w-[120px] w-auto h-auto rounded-lg"
    />
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer inline-block"
      >
        {content}
      </button>
    );
  }
  return content;
}

interface Props {
  message: Message;
  /** Сообщение в канале — отображаем как пост канала (аватар/название канала, без имени пользователя). */
  isChannel?: boolean;
  channelTitle?: string | null;
  channelAvatarUrl?: string | null;
  /** Имя собеседника из контекста чата (для аватара, когда в сообщении нет senderName). */
  fallbackSenderName?: string | null;
  /** Аватар собеседника из контекста чата. */
  fallbackSenderAvatar?: string | null;
  /** Premium-статус отправителя из контекста (если в сообщении нет). */
  fallbackSenderIsPremium?: boolean;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sending': return <Clock className="h-3.5 w-3.5 text-bubble-meta" />;
    case 'sent': return <Check className="h-3.5 w-3.5 text-bubble-meta" />;
    case 'delivered': return <CheckCheck className="h-3.5 w-3.5 text-bubble-meta" />;
    case 'read': return <CheckCheck className="h-3.5 w-3.5 text-primary" />;
    case 'failed': return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    default: return null;
  }
}

function ViewCount({ count }: { count: number }) {
  const display = count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count);
  return (
    <span className="inline-flex items-center gap-0.5 text-bubble-meta">
      <Eye className="h-3 w-3" />
      <span className="text-[10px]">{display}</span>
    </span>
  );
}

/** Превью истории над ответом. */
function StoryReplyPreviewBlock({
  preview,
  onOpenMedia,
  className,
}: {
  preview: NonNullable<Message['replyToStoryPreview']>;
  onOpenMedia: () => void;
  /** Для встраивания в общую карточку с реакцией (без отдельной рамки). */
  className?: string;
}) {
  const proxiedUrl = useMediaUrl(preview.mediaId ?? null);
  const src = pickMediaUrl(proxiedUrl, null, !!preview.mediaId?.trim());
  return (
    <div
      className={cn(
        'mb-1.5 w-full max-w-[min(100%,280px)] overflow-hidden rounded-xl border border-border bg-card/90 shadow-sm',
        className,
      )}
    >
      <div className="flex min-h-[5.5rem] items-stretch">
        <div className="relative h-[5.5rem] w-[5.75rem] shrink-0 bg-muted">
          {src ? (
            <button
              type="button"
              onClick={onOpenMedia}
              className="block h-full w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600/35 to-fuchsia-500/25 px-1 text-center text-[10px] text-muted-foreground">
              История
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">История</p>
          <p className="truncate text-xs font-semibold text-foreground">{preview.ownerName || 'Контакт'}</p>
          {preview.caption ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{preview.caption}</p>
          ) : (
            <p className="mt-0.5 text-[11px] text-muted-foreground">Ответ на историю</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function MessageBubble({ message, isChannel, channelTitle, channelAvatarUrl, fallbackSenderName, fallbackSenderAvatar, fallbackSenderIsPremium }: Props) {
  const setReplyingTo = useMessageStore((s) => s.setReplyingTo);
  const openModal = useUiStore((s) => s.openModal);
  const isMine = message.isMine;
  const [showActions, setShowActions] = useState(false);
  const [stickerPackPreviewMediaId, setStickerPackPreviewMediaId] = useState<string | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showAsChannelPost = !!isChannel;
  const leftAvatar = showAsChannelPost ? (channelAvatarUrl ?? null) : ((message.senderAvatar?.trim() || fallbackSenderAvatar?.trim()) || null);
  const leftName = showAsChannelPost ? (channelTitle ?? 'Канал') : (message.senderName?.trim() || fallbackSenderName?.trim() || '');
  const isVideoNoteOnly =
    message.contentType === 'video_note' &&
    (message.mediaUrl || message.mediaId) &&
    !message.textContent?.trim();

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShowActions(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => setShowActions(false), 200);
  };

  function handleMediaClick(type: 'image' | 'video' | 'video_note', url: string | null, mediaId?: string | null) {
    if (url || mediaId) {
      openModal('media-viewer', { url: url ?? undefined, mediaId: mediaId ?? undefined, type });
    }
  }

  const handleForward = () => {
    openModal('forward', { message, fromChatId: message.chatId });
  };

  const actionButtons = showActions && (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-card/95 shadow-sm px-1 py-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 min-w-6 shrink-0"
        onClick={() => setReplyingTo(message)}
        title="Ответить"
      >
        <Reply className="h-3 w-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 min-w-6 shrink-0"
        onClick={handleForward}
        title="Переслать"
      >
        <Forward className="h-3 w-3" />
      </Button>
    </div>
  );

  return (
    <motion.div
      initial={isMine ? { opacity: 0, y: 8 } : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn('flex gap-2 mb-1 items-end', isMine && !isChannel ? 'justify-end' : 'justify-start')}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isMine && !isChannel && actionButtons}
      {(!isMine || isChannel) && (
        <UserAvatar
          src={leftAvatar}
          name={leftName}
          size="sm"
          className="mb-1 shrink-0"
        />
      )}

      <div className={cn('max-w-[70%] relative', isVideoNoteOnly && 'max-w-none')}>
        {message.storyReactionEmoji && message.replyToStoryId && (
          <div className="mb-1.5 w-full max-w-[min(100%,280px)] overflow-hidden rounded-xl border border-border bg-card/90 shadow-sm">
            {message.replyToStoryPreview ? (
              <StoryReplyPreviewBlock
                preview={message.replyToStoryPreview}
                className="mb-0 max-w-none rounded-none border-0 shadow-none"
                onOpenMedia={() => {
                  const mid = message.replyToStoryPreview?.mediaId?.trim();
                  if (!mid) return;
                  openModal('media-viewer', {
                    mediaId: mid,
                    type: message.contentType === 'video' ? 'video' : 'image',
                  });
                }}
              />
            ) : (
              <div className="flex items-center gap-2 border-b border-border/60 bg-secondary/30 px-3 py-2">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-violet-500/50 via-fuchsia-500/40 to-amber-400/50 ring-1 ring-white/10" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">История</p>
                  <p className="truncate text-xs text-muted-foreground">Ответ на историю</p>
                </div>
              </div>
            )}
            <div className="border-t border-border/60 bg-secondary/40 px-3 py-2 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Реакция на историю</p>
              <p className="mt-1 text-3xl leading-none">{message.storyReactionEmoji}</p>
            </div>
          </div>
        )}
        {message.replyToStoryId && !message.storyReactionEmoji && message.replyToStoryPreview && (
          <StoryReplyPreviewBlock
            preview={message.replyToStoryPreview}
            onOpenMedia={() => {
              const mid = message.replyToStoryPreview?.mediaId?.trim();
              if (!mid) return;
              openModal('media-viewer', {
                mediaId: mid,
                type:
                  isStoryPreviewMediaDuplicate(message) && message.contentType === 'video'
                    ? 'video'
                    : 'image',
              });
            }}
          />
        )}
        {message.replyToStoryId && !message.storyReactionEmoji && !message.replyToStoryPreview && (
          <div className="mb-1 flex max-w-[min(100%,280px)] items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 text-xs shadow-sm">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-violet-500/50 via-fuchsia-500/40 to-amber-400/50 ring-1 ring-white/10" />
            <div className="min-w-0">
              <p className="font-semibold text-primary">История</p>
              <p className="truncate text-muted-foreground">Ответ на историю</p>
            </div>
          </div>
        )}
        {message.replyToPreview && (
          <div className="mb-1 rounded-t-lg border-l-2 border-primary bg-primary/5 px-3 py-1.5 text-xs">
            <span className="font-medium text-primary">{message.replyToPreview.senderName}</span>
            <p className="text-muted-foreground truncate">{message.replyToPreview.text}</p>
          </div>
        )}

        {message.forwardFrom && (
          <div className="mb-1 flex items-center gap-1 text-xs text-primary">
            <Forward className="h-3 w-3" />
            <span>
              {message.forwardFrom.chatTitle
                ? `Переслано из ${message.forwardFrom.chatTitle}`
                : message.forwardFrom.senderName
                  ? `Переслано от ${message.forwardFrom.senderName}`
                  : 'Переслано'}
            </span>
          </div>
        )}

        {isVideoNoteOnly ? (
          <div className={cn('flex flex-col gap-1', isMine ? 'items-end' : 'items-start')}>
            <VideoNotePlayer
              url={message.mediaUrl}
              mediaId={message.mediaId}
              isMine={message.isMine}
              durationHint={message.mediaMetadata?.duration}
              compact
              onExpand={() => handleMediaClick('video_note', message.mediaUrl, message.mediaId)}
            />
            <div className={cn('flex items-center gap-1', isMine ? 'justify-end' : 'justify-start')}>
              {message.isEdited && <span className="text-[10px] text-bubble-meta">ред.</span>}
              <span className="text-[10px] text-bubble-meta">{formatMessageTime(message.createdAt)}</span>
              {isChannel ? <ViewCount count={message.viewCount ?? 0} /> : isMine && <StatusIcon status={message.status} />}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'px-3 py-2 leading-relaxed shadow-sm',
              isMine && !isChannel
                ? 'bg-bubble-mine text-foreground bubble-tail-mine'
                : 'bg-bubble-other text-foreground bubble-tail-other',
              (message.replyToPreview ||
                message.replyToStoryId ||
                message.storyReactionEmoji ||
                message.replyToStoryPreview) &&
                'rounded-t-none',
            )}
            style={{ borderRadius: 'var(--bubble-radius, 1rem)', ...(isMine && !isChannel ? { borderBottomRightRadius: '0.25rem' } : { borderBottomLeftRadius: '0.25rem' }) }}
          >
            {(!isMine || isChannel) && leftName && (
              <p className="font-semibold text-xs text-primary mb-0.5">
                {showAsChannelPost ? (
                  leftName
                ) : (
                  <DisplayNameWithBadge
                    name={message.senderName?.trim() || fallbackSenderName?.trim() || ''}
                    isPremium={message.senderIsPremium ?? fallbackSenderIsPremium}
                    badgeEmoji={message.senderPremiumBadgeEmoji}
                    isVerified={message.senderIsVerified}
                    isOfficial={message.senderIsOfficial}
                    size="sm"
                  />
                )}
              </p>
            )}

            {message.contentType === 'image' &&
              (message.mediaUrl || message.mediaId) &&
              !isStoryPreviewMediaDuplicate(message) && (
              <ImageThumbnail
                url={message.mediaUrl}
                mediaId={message.mediaId}
                onClick={() => handleMediaClick('image', message.mediaUrl, message.mediaId)}
              />
            )}

            {message.contentType === 'voice' && (message.mediaUrl || message.mediaId) && (
              <VoiceMessagePlayer url={message.mediaUrl} mediaId={message.mediaId} isMine={message.isMine} durationHint={message.mediaMetadata?.duration} />
            )}

            {message.contentType === 'video' &&
              (message.mediaUrl || message.mediaId) &&
              !isStoryPreviewMediaDuplicate(message) && (
              <VideoThumbnail
                url={message.mediaUrl}
                mediaId={message.mediaId}
                onClick={() => handleMediaClick('video', message.mediaUrl, message.mediaId)}
              />
            )}

            {message.contentType === 'video_note' && (message.mediaUrl || message.mediaId) && (
              <VideoNotePlayer
                url={message.mediaUrl}
                mediaId={message.mediaId}
                isMine={message.isMine}
                durationHint={message.mediaMetadata?.duration}
                compact
                onExpand={() => handleMediaClick('video_note', message.mediaUrl, message.mediaId)}
              />
            )}

            {message.contentType === 'audio' && (message.mediaUrl || message.mediaId) && (
              <AudioPlayer url={message.mediaUrl} mediaId={message.mediaId} isMine={message.isMine} />
            )}

            {message.contentType === 'document' && (message.mediaUrl || message.mediaId) && (
              <DocumentLink url={message.mediaUrl} mediaId={message.mediaId} fileName={message.mediaMetadata?.fileName} />
            )}

            {message.contentType === 'sticker' && (message.mediaUrl || message.mediaId) && (
              <StickerThumbnail
                url={message.mediaUrl}
                mediaId={message.mediaId}
                onClick={() => setStickerPackPreviewMediaId(message.mediaId ?? null)}
              />
            )}

            {message.textContent &&
              !(message.storyReactionEmoji && message.textContent.trim() === message.storyReactionEmoji) && (
              <p style={{ fontSize: 'var(--message-font-size, 14px)' }}>
                <MessageTextWithEmoji text={message.textContent} emojiSize={20} />
              </p>
            )}

            <div className={cn('flex items-center gap-1 mt-1', 'justify-end')}>
              {message.isEdited && <span className="text-[10px] text-bubble-meta">ред.</span>}
              <span className="text-[10px] text-bubble-meta">{formatMessageTime(message.createdAt)}</span>
              {isChannel ? <ViewCount count={message.viewCount ?? 0} /> : isMine && <StatusIcon status={message.status} />}
            </div>
          </div>
        )}

        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((r) => (
              <motion.span
                key={r.emoji}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:scale-110 transition-transform',
                  r.reacted ? 'bg-primary/10 border-primary' : 'bg-secondary border-border',
                )}
              >
                {/^:[\w+_-]+:$/.test(r.emoji) ? (
                  <>
                    <CustomEmojiInline shortcode={r.emoji} size={14} />
                    {r.count}
                  </>
                ) : (
                  <>{r.emoji} {r.count}</>
                )}
              </motion.span>
            ))}
          </div>
        )}
      </div>
      {!isMine && actionButtons}
      {stickerPackPreviewMediaId &&
        typeof document !== 'undefined' &&
        createPortal(
          <StickerPackPreviewModal
            stickerMediaId={stickerPackPreviewMediaId}
            onClose={() => setStickerPackPreviewMediaId(null)}
          />,
          document.body,
        )}
    </motion.div>
  );
}
