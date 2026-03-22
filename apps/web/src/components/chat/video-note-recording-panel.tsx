'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, Send, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CircularProgress } from './circular-progress';

const MAX_DURATION_SEC = 60;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  stream: MediaStream | null;
  /** Записанное видео для показа при паузе */
  recordedPreviewBlob?: Blob | null;
  isPaused: boolean;
  durationSec: number;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onSend: () => void;
  /** Переключение фронтальная / задняя камера (без остановки записи). */
  onFlipCamera?: () => void;
  facingMode?: 'user' | 'environment';
}

export function VideoNoteRecordingPanel({
  stream,
  recordedPreviewBlob,
  isPaused,
  durationSec,
  onPause,
  onResume,
  onCancel,
  onSend,
  onFlipCamera,
  facingMode = 'user',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (recordedPreviewBlob) {
      const url = URL.createObjectURL(recordedPreviewBlob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
    return undefined;
  }, [recordedPreviewBlob]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPaused && previewUrl) {
      v.srcObject = null;
      v.src = previewUrl;
      v.muted = false;
      v.load();
      v.play().catch(() => {});
    } else if (stream) {
      v.src = '';
      v.srcObject = stream;
      v.muted = true;
    }
    return () => {
      if (v) {
        v.srcObject = null;
        v.src = '';
      }
    };
  }, [stream, isPaused, previewUrl]);

  const isMaxReached = durationSec >= MAX_DURATION_SEC;
  const progress = Math.min(durationSec / MAX_DURATION_SEC, 1);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg overflow-hidden rounded-t-3xl border border-border/70 bg-[#1a1d24] px-3 py-3 text-white shadow-[0_-12px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl md:relative md:inset-auto md:z-auto md:mx-2 md:mb-2 md:rounded-3xl md:shadow-2xl',
      )}
      role="dialog"
      aria-label="Запись видеосообщения"
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span>Видеосообщение</span>
          {isPaused && <span className="text-xs font-normal text-white/60">на паузе</span>}
        </div>
        <div className="flex items-center gap-2">
          {onFlipCamera && !isPaused && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-white/90 hover:bg-white/10"
              onClick={onFlipCamera}
              title={facingMode === 'user' ? 'Задняя камера' : 'Фронтальная камера'}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <span className="text-sm font-bold tabular-nums">{formatTime(durationSec)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <CircularProgress
            progress={progress}
            size={88}
            strokeWidth={3}
          >
            <div className={cn(
              'relative flex h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full bg-black ring-2 transition-all duration-200',
              isPaused ? 'ring-primary/30' : 'ring-red-500/60'
            )}>
              {isPaused && previewUrl ? (
                <video
                  ref={videoRef}
                  src={previewUrl}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  loop
                  autoPlay
                />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={cn('w-full h-full object-cover', facingMode === 'user' && 'mirror')}
                />
              )}
            </div>
          </CircularProgress>

          {!isPaused && !isMaxReached && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-full bg-red-500/25"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        <div className="flex h-9 flex-1 items-center rounded-xl bg-white/10 px-2 text-xs text-white/70">
          {!isPaused
            ? facingMode === 'user'
              ? 'Фронтальная камера · свайп для отмены'
              : 'Задняя камера'
            : 'Пауза — проверь запись или продолжи'}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={onCancel}
            title="Удалить"
            disabled={isMaxReached}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-9 w-9 rounded-full',
              isPaused ? 'text-primary hover:text-primary hover:bg-primary/10' : 'text-destructive hover:text-destructive hover:bg-destructive/10'
            )}
            onClick={isPaused ? onResume : onPause}
            title={isPaused ? 'Продолжить' : 'Пауза'}
            disabled={isMaxReached}
          >
            {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
          </Button>
          <Button
            size="icon"
            className="h-9 w-9 rounded-full gradient-primary border-0 text-white shadow-md"
            onClick={onSend}
            title="Отправить"
            disabled={durationSec < 0.5 || isMaxReached}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isMaxReached && (
        <p className="mt-1 px-1 text-xs text-muted-foreground">Макс. 60 сек, отправь или удали запись</p>
      )}
    </motion.div>
  );
}
