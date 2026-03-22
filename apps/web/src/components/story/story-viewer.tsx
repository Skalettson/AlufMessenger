'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Eye, MoreVertical, Send, VolumeX, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { api, getErrorMessage } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMediaUrlWithType } from '@/hooks/use-media-url';
import { formatMessageTime, isStoryVideoMedia, pickMediaUrl } from '@/lib/utils';
import type { Story } from '@/types';

interface Props {
  stories: Story[];
  user: { id?: string; displayName: string; avatarUrl: string | null };
  isOwn?: boolean;
  onClose: () => void;
  onDelete?: (storyId: string) => void;
}

const IMAGE_STORY_DURATION_MS = 5000;
const TICK_MS = 50;

export function StoryViewer({ stories, user, isOwn, onClose, onDelete }: Props) {
  const [index, setIndex] = useState(0);
  const [storyList, setStoryList] = useState(stories);
  const current = storyList[index];
  const { url: proxiedMediaUrl, mimeType } = useMediaUrlWithType(current?.mediaId ?? null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  /** Автоплей с звуком часто блокируется — после отказа включаем muted и показываем кнопку «звук». */
  const [videoMuted, setVideoMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [viewCount, setViewCount] = useState<number | null>(null);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<
    Array<{
      userId?: string;
      displayName?: string;
      username?: string;
      avatarUrl?: string;
      reactionEmoji?: string;
      viewedAt?: unknown;
    }>
  >([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyFocused, setReplyFocused] = useState(false);
  const [replyError, setReplyError] = useState('');
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [headerAvatar, setHeaderAvatar] = useState<string | null>(user.avatarUrl);
  const [avatarCacheBust, setAvatarCacheBust] = useState<string | number | null>(null);

  useEffect(() => { setStoryList(stories); }, [stories]);

  useEffect(() => {
    setHeaderAvatar(user.avatarUrl);
  }, [user.avatarUrl, user.id]);

  useEffect(() => {
    if (!user.id) return;
    let cancelled = false;
    api
      .get<Record<string, unknown>>(`/users/profile/${user.id}`)
      .then((r) => {
        if (cancelled || !r) return;
        const av = (r.avatar_url ?? r.avatarUrl) as string | null | undefined;
        const updated = (r.updated_at ?? r.updatedAt ?? r.avatar_updated_at ?? r.avatarUpdatedAt) as string | number | undefined;
        if (typeof av === 'string' && av.trim()) setHeaderAvatar(av);
        if (updated != null) setAvatarCacheBust(updated);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    if (!current) return;
    const fallbackVc = current.viewCount ?? 0;
    if (!isOwn) {
      api.post(`/stories/${current.id}/view`).catch(() => {});
      setViewCount(null);
      return;
    }
    setViewersLoading(true);
    api
      .get<{ viewers?: Array<Record<string, unknown>>; view_count?: number }>(`/stories/${current.id}/views`)
      .then((r) => {
        const list = Array.isArray(r?.viewers) ? r.viewers : [];
        setViewers(
          list.map((v) => ({
            userId: String(v.user_id ?? v.userId ?? ''),
            displayName: String(v.display_name ?? v.displayName ?? ''),
            username: String(v.username ?? ''),
            avatarUrl: (v.avatar_url ?? v.avatarUrl) != null ? String(v.avatar_url ?? v.avatarUrl) : '',
            reactionEmoji: String(v.reaction_emoji ?? v.reactionEmoji ?? ''),
            viewedAt: v.viewed_at ?? v.viewedAt,
          })),
        );
        setViewCount(list.length);
      })
      .catch(() => {
        setViewCount(fallbackVc);
      })
      .finally(() => setViewersLoading(false));
  }, [current?.id, isOwn, current?.viewCount]);

  const prev = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setProgress(0);
    }
  }, [index]);

  const next = useCallback(() => {
    if (index < storyList.length - 1) {
      setIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [index, storyList.length, onClose]);

  const displayUrl = current
    ? pickMediaUrl(proxiedMediaUrl, current.mediaUrl ?? null, !!current.mediaId)
    : null;
  /** Пока blob по mediaId грузится — не запускаем 5-сек таймер «как для фото». */
  const mediaLoading = Boolean(current?.mediaId && !proxiedMediaUrl);
  const isVideo = Boolean(
    !mediaLoading && current && displayUrl && isStoryVideoMedia(mimeType, displayUrl),
  );

  useEffect(() => {
    setVideoMuted(false);
  }, [index]);

  /** Фото и текстовые сторис: фиксированная длительность. Видео — см. обработчики на <video>. */
  useEffect(() => {
    if (paused || replyFocused) return;
    if (isVideo) return;
    if (mediaLoading) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        const step = (TICK_MS / IMAGE_STORY_DURATION_MS) * 100;
        if (p >= 100) {
          if (index < storyList.length - 1) {
            setIndex((i) => i + 1);
            return 0;
          }
          setTimeout(() => onClose(), 0);
          return 100;
        }
        return Math.min(p + step, 100);
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [index, storyList.length, onClose, paused, replyFocused, isVideo, mediaLoading]);

  useEffect(() => {
    const v = videoRef.current;
    if (!isVideo || !v) return;
    if (paused) v.pause();
    else void v.play().catch(() => {});
  }, [paused, isVideo, index]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewersOpen) {
          setViewersOpen(false);
          return;
        }
        onClose();
      }
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, prev, next, viewersOpen]);

  const handlePointerDown = () => {
    holdTimerRef.current = setTimeout(() => setPaused(true), 200);
  };

  const handlePointerUp = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (paused) {
      setPaused(false);
    }
  };

  const deleteCurrentStory = useCallback(async () => {
    if (!current || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/stories/${current.id}`);
      onDelete?.(current.id);
      const updated = storyList.filter((s) => s.id !== current.id);
      if (updated.length === 0) { onClose(); return; }
      setStoryList(updated);
      if (index >= updated.length) setIndex(updated.length - 1);
      setProgress(0);
    } catch {} finally { setDeleting(false); setShowMenu(false); }
  }, [current, storyList, index, deleting, onClose, onDelete]);

  async function react(emoji: string) {
    if (!current) return;
    await api.post(`/stories/${current.id}/react`, { emoji }).catch(() => {});
  }

  const handleReply = async () => {
    if (!replyText.trim() || !user.id || !current) return;
    setReplyError('');
    try {
      const res = await api.post<{ chatId?: string; chat_id?: string }>(`/stories/${current.id}/reply`, {
        text: replyText.trim(),
      });
      setReplyText('');
      setReplyFocused(false);
      const cid = res?.chatId ?? res?.chat_id;
      if (cid && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aluf-open-chat', { detail: { chatId: cid } }));
      }
    } catch (e) {
      setReplyError(getErrorMessage(e) || 'Не удалось отправить ответ');
    }
  };

  if (!current) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex min-h-[100dvh] max-h-[100dvh] flex-col bg-black supports-[height:100dvh]:min-h-[100dvh]"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.35}
      onDragEnd={(_, info) => {
        if (info.offset.y > 72 || info.velocity.y > 400) onClose();
      }}
    >
      <div className="relative mx-auto flex h-full w-full max-w-lg flex-1 flex-col">
        <div className="flex gap-1 px-2 pt-1 sm:pt-2">
          {storyList.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
                style={{
                  width: i < index ? '100%' : i === index ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <UserAvatar
            src={headerAvatar}
            name={user.displayName}
            size="sm"
            cacheBust={avatarCacheBust}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user.displayName}</p>
            <p className="text-xs text-white/50">{formatMessageTime(current.createdAt)}</p>
          </div>
          <div className="flex items-center gap-1">
            {isOwn && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewersOpen(true);
                }}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/10 mr-1"
              >
                <Eye className="h-3.5 w-3.5" />
                {viewersLoading ? '…' : viewCount ?? current.viewCount ?? 0}
                <ChevronRight className="h-3 w-3 opacity-70" />
              </button>
            )}
            {paused && (
              <span className="text-[10px] text-white/40 mr-1">На паузе</span>
            )}
            {isVideo && videoMuted && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-8 w-8 shrink-0"
                title="Включить звук"
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoMuted(false);
                  const el = videoRef.current;
                  if (el) {
                    el.muted = false;
                    void el.play();
                  }
                }}
              >
                <VolumeX className="h-4 w-4" />
              </Button>
            )}
            {isOwn && (
              <div className="relative">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-8 w-8" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden min-w-[140px]">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCurrentStory(); }}
                      disabled={deleting}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />{deleting ? 'Удаление...' : 'Удалить'}
                    </button>
                  </div>
                )}
              </div>
            )}
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div
          className="flex-1 flex items-center justify-center px-4 relative select-none"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={(e) => {
            if (paused) return;
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 3) prev();
            else next();
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full flex items-center justify-center"
            >
              {displayUrl ? (
                isVideo ? (
                  <video
                    ref={videoRef}
                    src={displayUrl}
                    className="max-w-full max-h-full object-contain rounded-xl pointer-events-none"
                    playsInline
                    muted={videoMuted}
                    autoPlay
                    preload="auto"
                    onTimeUpdate={(e) => {
                      const v = e.currentTarget;
                      const d = v.duration;
                      if (!d || !Number.isFinite(d)) return;
                      setProgress((v.currentTime / d) * 100);
                    }}
                    onEnded={() => {
                      setProgress(100);
                      if (index < storyList.length - 1) {
                        setIndex((i) => i + 1);
                      } else {
                        setTimeout(() => onClose(), 0);
                      }
                    }}
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      setProgress(0);
                      setVideoMuted(false);
                      v.muted = false;
                      void v.play().catch(() => {
                        setVideoMuted(true);
                        v.muted = true;
                        void v.play().catch(() => {});
                      });
                    }}
                  />
                ) : (
                  <img
                    src={displayUrl}
                    alt=""
                    className="max-w-full max-h-full object-contain rounded-xl pointer-events-none"
                    draggable={false}
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-white text-xl font-bold text-center px-8 leading-relaxed">
                    {current.caption || '…'}
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {current.caption && displayUrl && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-2"
          >
            <p className="text-white text-sm text-center">{current.caption}</p>
          </motion.div>
        )}

        {!isOwn && (
          <div className="flex justify-center gap-3 py-2">
            {['❤️', '🔥', '👍', '😂', '😮', '😢'].map((e) => (
              <motion.button
                key={e}
                type="button"
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.8, y: -10 }}
                onClick={() => react(e)}
                className="text-2xl"
              >
                {e}
              </motion.button>
            ))}
          </div>
        )}

        {!isOwn && (
          <div className="flex flex-col gap-1 px-4 pb-3">
            {replyError ? (
              <p className="text-center text-xs text-red-300">{replyError}</p>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setReplyFocused(true)}
                onBlur={() => {
                  if (!replyText.trim()) setReplyFocused(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReply();
                }}
                placeholder="Ответить в личные сообщения..."
                className="flex-1 rounded-full border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 transition-colors focus:border-white/25 focus:bg-white/15"
              />
              {replyText.trim() ? (
                <motion.button
                  type="button"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={handleReply}
                  className="rounded-full bg-primary p-2.5 text-primary-foreground shadow-lg"
                >
                  <Send className="h-4 w-4" />
                </motion.button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewersOpen && isOwn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
            onClick={() => setViewersOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="max-h-[min(70dvh,520px)] w-full max-w-md rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Просмотры</h3>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewersOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-[min(55dvh,420px)] p-2">
                {viewers.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">Пока никто не смотрел</p>
                ) : (
                  <ul className="space-y-1">
                    {viewers.map((v) => (
                      <li
                        key={v.userId}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary/60"
                      >
                        <UserAvatar src={v.avatarUrl || null} name={v.displayName || v.username || ''} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{v.displayName || v.username}</p>
                          {v.username ? (
                            <p className="truncate text-xs text-muted-foreground">@{v.username}</p>
                          ) : null}
                        </div>
                        {v.reactionEmoji ? (
                          <span className="text-lg" title="Реакция">
                            {v.reactionEmoji}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
