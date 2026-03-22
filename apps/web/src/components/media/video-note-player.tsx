'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { useMediaUrl } from '@/hooks/use-media-url';
import { cn, formatMediaDuration, pickMediaUrl } from '@/lib/utils';

interface VideoNotePlayerProps {
  url: string | null;
  mediaId?: string | null;
  isMine?: boolean;
  durationHint?: number;
  /** Компактный режим в пузыре сообщения. */
  compact?: boolean;
  /** Режим полноэкранного просмотра в модалке. */
  fullscreen?: boolean;
  onExpand?: () => void;
  className?: string;
}

/** Кольцо прогресса по всему кругу (360°), плавное. */
function CircularProgressRing({
  progress,
  size,
  isMine,
  strokeWidth = 3,
}: {
  progress: number;
  size: number;
  isMine?: boolean;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const p = Math.max(0, Math.min(1, progress));
  const circumference = 2 * Math.PI * r;
  const stroke = isMine ? 'rgba(255,255,255,0.9)' : 'var(--primary)';

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 pointer-events-none"
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* Фон кольца по всему кругу */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={strokeWidth}
      />
      {/* Заполнение по прогрессу: полный круг, видимая часть = progress */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - p)}
      />
    </svg>
  );
}

export function VideoNotePlayer({
  url,
  mediaId,
  isMine,
  durationHint,
  compact = true,
  fullscreen = false,
  onExpand,
  className,
}: VideoNotePlayerProps) {
  const proxiedUrl = useMediaUrl(mediaId ?? null);
  const playUrl = pickMediaUrl(proxiedUrl, url, !!mediaId);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint || 0);
  const [muted, setMuted] = useState(false);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playUrl) return;
    const onLoadedMetadata = () => setDuration(video.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      setCurrentTime(video.currentTime);
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [playUrl]);

  // Плавное обновление прогресса при воспроизведении (requestAnimationFrame вместо редкого timeupdate)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;
    let rafId: number;
    const tick = () => {
      setCurrentTime(video.currentTime);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  const progress = duration > 0 ? currentTime / duration : 0;
  const strokeWidth = fullscreen ? 4 : 3;
  const size = fullscreen ? 320 : compact ? 160 : 200;

  if (!playUrl) {
    return (
      <div
        className={cn(
          'rounded-full flex items-center justify-center bg-black/20',
          isMine ? 'text-white/70' : 'text-muted-foreground',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <span className="text-xs">Загрузка...</span>
      </div>
    );
  }

  const displayTime = isPlaying ? currentTime : duration;

  return (
    <div className={cn('inline-flex flex-col items-center', className)}>
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          'relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
          'active:scale-[0.98]',
        )}
        style={{ width: size, height: size }}
      >
        <video
          ref={videoRef}
          src={playUrl}
          className="w-full h-full object-cover"
          playsInline
          preload="metadata"
        />
        {/* Оверлей при паузе */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div
              className={cn(
                'rounded-full flex items-center justify-center',
                fullscreen ? 'w-20 h-20' : 'w-14 h-14',
                isMine ? 'bg-white/25' : 'bg-black/30',
              )}
            >
              <Play className={cn('fill-current text-white drop-shadow-md', fullscreen ? 'h-10 w-10 ml-1' : 'h-7 w-7 ml-0.5')} />
            </div>
          </div>
        )}
        {/* Кольцо прогресса по всему кругу */}
        <CircularProgressRing progress={progress} size={size} isMine={isMine} strokeWidth={strokeWidth} />
        {/* Время в правом нижнем углу внутри круга */}
        <span
          className={cn(
            'absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded',
            'text-white/95 bg-black/40',
          )}
        >
          {formatMediaDuration(displayTime)}
        </span>
      </button>

      {/* Кнопки под кругом только в fullscreen (звук) или для expand */}
      {(fullscreen || onExpand) && (
        <div className="flex items-center gap-2 mt-2">
          {fullscreen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMuted((m) => !m);
              }}
              className={cn(
                'p-1.5 rounded-full transition-colors',
                isMine ? 'text-white/80 hover:bg-white/20' : 'text-muted-foreground hover:bg-black/10',
              )}
              aria-label={muted ? 'Включить звук' : 'Выключить звук'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
          {onExpand && !fullscreen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className={cn(
                'p-1.5 rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-black/10',
              )}
              title="Открыть в полном размере"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
