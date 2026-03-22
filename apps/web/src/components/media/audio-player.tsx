'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Music } from 'lucide-react';
import { useMediaUrl } from '@/hooks/use-media-url';
import { cn, formatMediaDuration, pickMediaUrl } from '@/lib/utils';
import { useAudioVisualizer } from '@/hooks/use-audio-visualizer';

interface AudioPlayerProps {
  url: string | null;
  mediaId?: string | null;
  /** Своё сообщение — другой стиль (светлые акценты). */
  isMine?: boolean;
  className?: string;
}

const WAVEFORM_BARS = 64;

export function AudioPlayer({ url, mediaId, isMine, className }: AudioPlayerProps) {
  const proxiedUrl = useMediaUrl(mediaId ?? null);
  const playUrl = pickMediaUrl(proxiedUrl, url, !!mediaId);

  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const { barHeights, canvasRef } = useAudioVisualizer({
    audioElement: audioRef.current,
    barCount: WAVEFORM_BARS,
    enabled: isPlaying,
  });

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }, []);

  const safeSetCurrentTime = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!Number.isFinite(value)) return;
    audio.currentTime = Math.max(0, value);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playUrl) return;
    const onTimeUpdate = () => setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    const onLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [playUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * duration;
    if (!Number.isFinite(newTime)) return;
    safeSetCurrentTime(newTime);
    setCurrentTime(newTime);
  }, [duration, safeSetCurrentTime]);

  const formatDur = formatMediaDuration;

  if (!playUrl) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-3 py-2 px-3 rounded-xl min-w-[200px]',
          isMine ? 'bg-white/15 text-white/90' : 'bg-muted/80 text-muted-foreground',
          className,
        )}
      >
        <Music className="h-5 w-5 shrink-0 opacity-70" />
        <span className="text-sm">Загрузка...</span>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        'inline-flex flex-col gap-2 py-2 px-3 rounded-xl min-w-[240px] max-w-[320px]',
        isMine ? 'bg-white/15' : 'bg-muted/80',
        className,
      )}
    >
      <audio ref={audioRef} src={playUrl} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent',
            isMine
              ? 'bg-white/25 hover:bg-white/35 text-white focus:ring-white/40'
              : 'bg-primary/20 hover:bg-primary/30 text-primary focus:ring-primary/50',
          )}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current ml-0.5" />
          )}
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Music className={cn('h-4 w-4 flex-shrink-0', isMine ? 'text-white/70' : 'text-muted-foreground')} />
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {/* Waveform визуализация */}
            <div
              ref={waveformContainerRef}
              className="relative h-8 w-full cursor-pointer"
              onClick={handleSeek}
            >
              {/* Canvas для реальной визуализации */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ display: isPlaying ? 'block' : 'none' }}
              />
              {/* Статичная вейвформа с прогрессом */}
              {!isPlaying && (
                <div className="flex items-center gap-[2px] h-full w-full">
                  {Array.from({ length: WAVEFORM_BARS }).map((_, i) => {
                    const isPlayed = (i + 0.5) / WAVEFORM_BARS <= progress / 100;
                    const h = barHeights[i] || 0.5;
                    return (
                      <div
                        key={i}
                        className={cn(
                          'w-[2px] min-w-[2px] rounded-full flex-shrink-0 transition-colors',
                          isPlayed
                            ? isMine
                              ? 'bg-white/90'
                              : 'bg-primary'
                            : isMine
                              ? 'bg-white/35'
                              : 'bg-muted-foreground/40',
                        )}
                        style={{ height: `${Math.round(4 + h * 24)}px` }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
            {/* Progress bar для точного позиционирования */}
            <div
              role="progressbar"
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={duration}
              className={cn(
                'h-1.5 rounded-full cursor-pointer transition-colors',
                isMine ? 'bg-white/30 hover:bg-white/40' : 'bg-primary/20 hover:bg-primary/30',
              )}
              onClick={handleSeek}
            >
              <div
                className={cn('h-full rounded-full transition-all', isMine ? 'bg-white/90' : 'bg-primary')}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        <span
          className={cn(
            'text-xs font-medium tabular-nums flex-shrink-0 min-w-[4rem] text-right',
            isMine ? 'text-white/90' : 'text-muted-foreground',
          )}
        >
          {formatDur(currentTime)} / {formatDur(duration)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className={cn(
            'p-1 rounded-full transition-colors focus:outline-none',
            isMine ? 'text-white/80 hover:bg-white/20' : 'text-muted-foreground hover:bg-black/10',
          )}
          aria-label={muted ? 'Включить звук' : 'Выключить звук'}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => {
            setVolume(Number(e.target.value));
            setMuted(Number(e.target.value) === 0);
          }}
          className={cn(
            'w-20 h-1 rounded-full cursor-pointer',
            isMine ? 'accent-white' : 'accent-primary',
          )}
        />
      </div>
    </div>
  );
}
