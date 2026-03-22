'use client';

import { useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/ui-store';
import { useMediaUrl } from '@/hooks/use-media-url';
import { pickMediaUrl } from '@/lib/utils';
import { VideoPlayer } from '@/components/media/video-player';
import { VideoNotePlayer } from '@/components/media/video-note-player';

interface MediaItem {
  url?: string;
  mediaId?: string;
  type: 'image' | 'video';
  fileName?: string;
  /** Видеокружок — показываем в режиме «увеличение» (на весь экран, без панели плеера). */
  isVideoNote?: boolean;
}

interface Props {
  items: MediaItem[];
  open: boolean;
  onClose: () => void;
}

function MediaContent({ url, type, isVideoNote }: { url: string | null; type: 'image' | 'video'; isVideoNote?: boolean }) {
  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-white/80">
        <Loader2 className="h-12 w-12 animate-spin" />
        <span className="text-sm">Загрузка...</span>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <img
        src={url}
        alt=""
        className="max-w-[95vw] max-h-[90vh] object-contain select-none rounded-lg shadow-2xl"
        draggable={false}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (isVideoNote) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black" onClick={(e) => e.stopPropagation()}>
        <VideoNotePlayer url={url} fullscreen isMine={false} className="text-white" />
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center w-full max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
      <VideoPlayer src={url} autoPlay className="max-w-full max-h-[85vh] w-auto" />
    </div>
  );
}

export function MediaViewer({ items, open, onClose }: Props) {
  const index = useUiStore((s) => s.mediaViewerIndex);
  const setIndex = useUiStore((s) => s.setMediaViewerIndex);

  const current = items[index];

  const handlePrev = useCallback(() => setIndex(Math.max(0, index - 1)), [index, setIndex]);
  const handleNext = useCallback(() => setIndex(Math.min(items.length - 1, index + 1)), [index, items.length, setIndex]);

  const mediaIdToFetch = open && current ? (current.mediaId ?? null) : null;
  const resolvedUrl = useMediaUrl(mediaIdToFetch);
  const displayUrl = pickMediaUrl(resolvedUrl, current?.url, !!current?.mediaId);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, handlePrev, handleNext]);

  if (!open || !current) return null;

  const isVideoNoteOnly = current.isVideoNote && items.length === 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black"
        onClick={onClose}
      >
        {!isVideoNoteOnly && (
          <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-end gap-2 px-4 z-20 bg-gradient-to-b from-black/60 to-transparent">
            {displayUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 rounded-full transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(displayUrl, '_blank');
                }}
              >
                <Download className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-full transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}

        {isVideoNoteOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-30 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Закрыть"
          >
            <X className="h-6 w-6" />
          </Button>
        )}

        {items.length > 1 && index > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-20 rounded-full w-12 h-12 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
        )}

        <motion.div
          key={`${current.url ?? current.mediaId}-${index}`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className={current.isVideoNote ? 'absolute inset-0 flex items-center justify-center' : 'flex items-center justify-center flex-1 px-4 pt-14 pb-8'}
          onClick={(e) => e.stopPropagation()}
        >
          <MediaContent url={displayUrl} type={current.type} isVideoNote={current.isVideoNote} />
        </motion.div>

        {items.length > 1 && index < items.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-20 rounded-full w-12 h-12 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        )}

        {items.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 text-white/90 text-sm font-medium">
            {index + 1} / {items.length}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
