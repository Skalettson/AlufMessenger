'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { cn, formatMediaDuration } from '@/lib/utils';

interface VideoPlayerProps {
  src: string | null;
  poster?: string | null;
  className?: string;
  autoPlay?: boolean;
  onClose?: () => void;
}

export function VideoPlayer({ src, poster, className, autoPlay, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleTimeUpdate = useCallback(() => {
    if (!isSeeking && videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }, [isSeeking]);
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const d = videoRef.current.duration;
      setDuration(Number.isFinite(d) ? d : 0);
    }
  }, []);
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    let ratio = 0;
    if ('clientX' in e) {
      const el = e.currentTarget as HTMLDivElement;
      const rect = el.getBoundingClientRect();
      ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    } else {
      ratio = Number((e.target as HTMLInputElement).value) / 100;
    }
    const time = ratio * duration;
    if (!Number.isFinite(time)) return;
    video.currentTime = Math.max(0, time);
    setCurrentTime(time);
  }, [duration]);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  const resetProgress = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    video.volume = muted ? 0 : volume;
  }, [volume, muted, src]);

  useEffect(() => {
    if (!src) return;
    const video = videoRef.current;
    if (autoPlay && video) video.play().catch(() => {});
  }, [src, autoPlay]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const t = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        video.currentTime = Math.max(0, t - 5);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const t = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        const d = Number.isFinite(video.duration) ? video.duration : t;
        video.currentTime = Math.min(d, t + 5);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute]);

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
      hideControlsTimer.current = null;
    }, 2500);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) setShowControls(true);
    else scheduleHideControls();
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [isPlaying, scheduleHideControls]);

  if (!src) {
    return (
      <div className={cn('flex items-center justify-center bg-black/80 rounded-xl aspect-video', className)}>
        <span className="text-white/70 text-sm">Нет видео</span>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn('relative rounded-xl overflow-hidden bg-black group', className)}
      onMouseMove={() => { setShowControls(true); scheduleHideControls(); }}
      onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        playsInline
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Center play/pause overlay */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-opacity duration-200',
          showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <button
          type="button"
          onClick={togglePlay}
          className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/60 flex items-center justify-center text-white transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
        >
          {isPlaying ? <Pause className="h-8 w-8 fill-current" /> : <Play className="h-8 w-8 fill-current ml-1" />}
        </button>
      </div>

      {/* Bottom controls bar */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent pt-8 pb-2 px-3 transition-opacity duration-200',
          showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {/* Progress bar — clickable */}
        <div
          className="h-1 rounded-full bg-white/30 cursor-pointer mb-3 group/progress"
          onClick={handleSeek}
          onMouseDown={() => setIsSeeking(true)}
          onMouseUp={() => setIsSeeking(false)}
          onMouseLeave={() => setIsSeeking(false)}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors focus:outline-none"
            aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
          </button>

          <span className="text-white/90 text-sm tabular-nums min-w-[4rem]">
            {formatMediaDuration(currentTime)} / {formatMediaDuration(duration)}
          </span>

          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors focus:outline-none ml-1"
            aria-label={muted ? 'Включить звук' : 'Выключить звук'}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
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
            className="w-16 h-1 accent-primary bg-white/30 rounded-full cursor-pointer"
          />

          <button
            type="button"
            onClick={resetProgress}
            className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors focus:outline-none"
            title="В начало"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-full text-white hover:bg-white/20 transition-colors focus:outline-none ml-auto"
            aria-label={isFullscreen ? 'Выйти из полного экрана' : 'Полный экран'}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
