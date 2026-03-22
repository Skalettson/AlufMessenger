'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { useMediaUrl } from '@/hooks/use-media-url';
import { cn, pickMediaUrl } from '@/lib/utils';
import { useAudioVisualizer } from '@/hooks/use-audio-visualizer';

const WAVEFORM_BARS = 42;

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  url: string | null;
  mediaId?: string | null;
  isMine?: boolean;
  durationHint?: number;
}

export function VoiceMessagePlayer({ url, mediaId, isMine, durationHint }: Props) {
  const proxiedUrl = useMediaUrl(mediaId ?? null);
  const playUrl = pickMediaUrl(proxiedUrl, url, !!mediaId);

  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint || 0);

  const safeSetCurrentTime = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!Number.isFinite(value)) return;
    audio.currentTime = Math.max(0, value);
  };

  const { barHeights, canvasRef } = useAudioVisualizer({
    audioElement: audioRef.current,
    barCount: WAVEFORM_BARS,
    enabled: isPlaying,
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playUrl) return;

    const handleTimeUpdate = () => setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    const handleLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [playUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play();
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = waveformContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(1, x)) * duration;
    if (!Number.isFinite(newTime)) return;
    safeSetCurrentTime(newTime);
    setCurrentTime(newTime);
  };

  if (!playUrl) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 py-1 pr-2 min-w-[140px]',
          isMine ? 'text-white/80' : 'text-muted-foreground',
        )}
      >
        <Mic className="h-5 w-5 shrink-0 opacity-70" />
        <span className="text-sm">Загрузка...</span>
      </div>
    );
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 py-1 pr-1 w-full min-w-0 max-w-[280px] overflow-hidden',
        isMine ? 'text-white' : 'text-foreground',
      )}
    >
      <audio ref={audioRef} src={playUrl} preload="metadata" crossOrigin="anonymous" onError={() => {
        if (audioRef.current && audioRef.current.crossOrigin) {
          audioRef.current.crossOrigin = '';
          audioRef.current.load();
        }
      }} />
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all',
          'hover:opacity-90 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/40',
          isMine
            ? 'bg-white/20 hover:bg-white/30'
            : 'bg-primary/15 hover:bg-primary/25 text-primary',
        )}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 fill-current" />
        ) : (
          <Play className="h-5 w-5 fill-current ml-0.5" />
        )}
      </button>

      <div
        ref={waveformContainerRef}
        role="progressbar"
        aria-valuenow={currentTime}
        aria-valuemin={0}
        aria-valuemax={duration}
        className="flex-1 min-w-0 relative h-6 cursor-pointer py-0.5"
        onClick={handleWaveformClick}
      >
        {/* Canvas для реальной визуализации */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: isPlaying ? 'block' : 'none' }}
        />
        {/* Статичная вейвформа с прогрессом */}
        {!isPlaying && (
          <div className="flex items-center justify-center gap-[2px] h-full w-full">
            {Array.from({ length: WAVEFORM_BARS }).map((_, i) => {
              const isPlayed = (i + 0.5) / WAVEFORM_BARS <= progress;
              // Используем barHeights из хука (даже когда не играет, они сохраняют последние значения)
              const h = barHeights[i] || 0.5;
              return (
                <div
                  key={i}
                  className={cn(
                    'w-[2px] min-w-[2px] rounded-full flex-shrink-0 transition-colors duration-75',
                    isPlayed
                      ? isMine
                        ? 'bg-white/90'
                        : 'bg-primary'
                      : isMine
                        ? 'bg-white/35'
                        : 'bg-muted-foreground/40',
                  )}
                  style={{ height: `${Math.round(4 + h * 16)}px` }}
                />
              );
            })}
          </div>
        )}
      </div>

      <span
        className={cn(
          'flex-shrink-0 text-xs font-medium tabular-nums min-w-[2.5rem] text-right',
          isMine ? 'text-white/90' : 'text-muted-foreground',
        )}
      >
        {isPlaying ? formatDuration(currentTime) : formatDuration(duration)}
      </span>
    </div>
  );
}
