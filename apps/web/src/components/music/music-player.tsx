'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMusicPlayerStore } from '@/stores/music-player-store';
import { useMediaUrl } from '@/hooks/use-media-url';
import { cn } from '@/lib/utils';

const SEEK_STEP_SEC = 5;
const PREV_RESTART_SEC = 3;
const VOLUME_STEP = 0.05;
const VOLUME_STORAGE_KEY = 'music-player-volume';

function loadStoredVolume(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const v = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (v == null) return 1;
    const n = parseFloat(v);
    if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  } catch {
    /* */
  }
  return 1;
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [volume, setVolume] = useState(loadStoredVolume);
  const [muted, setMuted] = useState(false);

  const queue = useMusicPlayerStore((s) => s.queue);
  const currentIndex = useMusicPlayerStore((s) => s.currentIndex);
  const isPlaying = useMusicPlayerStore((s) => s.isPlaying);
  const visible = useMusicPlayerStore((s) => s.visible);
  const setPlaying = useMusicPlayerStore((s) => s.setPlaying);
  const next = useMusicPlayerStore((s) => s.next);
  const prev = useMusicPlayerStore((s) => s.prev);
  const close = useMusicPlayerStore((s) => s.close);
  const currentTrack = useMusicPlayerStore((s) => s.currentTrack());

  const audioUrl = useMediaUrl(currentTrack?.audioMediaId);
  const coverUrl = useMediaUrl(currentTrack?.coverMediaId ?? null);

  const loading = Boolean(currentTrack?.audioMediaId && !audioUrl);

  const applySeekRatio = useCallback((ratio: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(duration) || duration <= 0) return;
    const r = Math.min(1, Math.max(0, ratio));
    el.currentTime = r * duration;
    setCurrentTime(el.currentTime);
  }, [duration]);

  const handlePrev = useCallback(() => {
    const el = audioRef.current;
    if (queue.length <= 1) {
      if (el) {
        el.currentTime = 0;
        setCurrentTime(0);
        void el.play().catch(() => setPlaying(false));
      }
      return;
    }
    if (el && el.currentTime > PREV_RESTART_SEC) {
      el.currentTime = 0;
      setCurrentTime(0);
      void el.play().catch(() => setPlaying(false));
      return;
    }
    prev();
  }, [queue.length, prev, setPlaying]);

  const handleNext = useCallback(() => {
    const el = audioRef.current;
    if (queue.length <= 1) {
      if (el) {
        el.currentTime = 0;
        setCurrentTime(0);
        void el.play().catch(() => setPlaying(false));
      }
      return;
    }
    next();
  }, [queue.length, next, setPlaying]);

  const syncMediaSession = useCallback(
    (track: typeof currentTrack, playing: boolean) => {
      if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
      const ms = navigator.mediaSession;
      if (!track) {
        ms.metadata = null;
        return;
      }
      ms.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.genre || 'Aluf',
        artwork: coverUrl
          ? [{ src: coverUrl, sizes: '512x512', type: 'image/jpeg' }]
          : undefined,
      });
      ms.playbackState = playing ? 'playing' : 'paused';
    },
    [coverUrl],
  );

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        const as = (navigator as Navigator & { audioSession?: { type?: string } }).audioSession;
        if (as) as.type = 'playback';
      } catch {
        /* Safari / older browsers */
      }
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => {
      setPlaying(true);
      void audioRef.current?.play();
    });
    ms.setActionHandler('pause', () => {
      setPlaying(false);
      audioRef.current?.pause();
    });
    ms.setActionHandler('previoustrack', () => handlePrev());
    ms.setActionHandler('nexttrack', () => handleNext());
    return () => {
      ms.setActionHandler('play', null);
      ms.setActionHandler('pause', null);
      ms.setActionHandler('previoustrack', null);
      ms.setActionHandler('nexttrack', null);
    };
  }, [handleNext, handlePrev, setPlaying]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    el.src = audioUrl;
    el.load();
  }, [audioUrl, currentTrack?.id]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted, audioUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
    } catch {
      /* */
    }
  }, [volume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    if (isPlaying) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [isPlaying, audioUrl, setPlaying]);

  useEffect(() => {
    syncMediaSession(currentTrack, isPlaying);
  }, [currentTrack, isPlaying, syncMediaSession]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (!seeking) setCurrentTime(el.currentTime);
    };
    const onDur = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onEnded = () => handleNext();
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('durationchange', onDur);
    el.addEventListener('loadedmetadata', onDur);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('durationchange', onDur);
      el.removeEventListener('loadedmetadata', onDur);
      el.removeEventListener('ended', onEnded);
    };
  }, [handleNext, seeking]);

  /** Горячие клавиши: не перехватываем в полях ввода */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
      }
      if (!visible || !queue.length || !currentTrack) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying(!isPlaying);
        return;
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const el = audioRef.current;
        if (e.altKey || e.metaKey || e.ctrlKey) {
          handlePrev();
          return;
        }
        if (el) {
          el.currentTime = Math.max(0, el.currentTime - SEEK_STEP_SEC);
          setCurrentTime(el.currentTime);
        }
        return;
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        const el = audioRef.current;
        if (e.altKey || e.metaKey || e.ctrlKey) {
          handleNext();
          return;
        }
        if (el && Number.isFinite(duration) && duration > 0) {
          el.currentTime = Math.min(duration, el.currentTime + SEEK_STEP_SEC);
          setCurrentTime(el.currentTime);
        }
        return;
      }
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        setMuted(false);
        setVolume((v) => Math.min(1, Math.round((v + VOLUME_STEP) * 1000) / 1000));
        return;
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume((v) => Math.max(0, Math.round((v - VOLUME_STEP) * 1000) / 1000));
        return;
      }
      if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setMuted((m) => !m);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, queue.length, currentTrack, isPlaying, setPlaying, duration, handleNext, handlePrev]);

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const onBarPointer = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || !Number.isFinite(duration) || duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    applySeekRatio(ratio);
  };

  const showBar = visible && queue.length > 0 && currentTrack;

  return (
    <>
      {showBar && (
      <div
        className={cn(
          'flex-shrink-0 z-30 border-b border-border bg-sidebar/95 backdrop-blur-md',
          'px-3 py-2 pt-[max(0.25rem,env(safe-area-inset-top))]',
        )}
      >
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                ♪
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{currentTrack.title}</p>
            <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right shrink-0">
                {formatTime(currentTime)}
              </span>
              <div
                ref={barRef}
                role="slider"
                tabIndex={0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
                className={cn(
                  'flex-1 h-2 rounded-full bg-muted overflow-hidden cursor-pointer touch-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                onPointerDown={(e) => {
                  if (!duration) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setSeeking(true);
                  onBarPointer(e.clientX);
                }}
                onPointerMove={(e) => {
                  if (!seeking) return;
                  onBarPointer(e.clientX);
                }}
                onPointerUp={(e) => {
                  setSeeking(false);
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    /* */
                  }
                }}
                onPointerCancel={() => {
                  setSeeking(false);
                }}
              >
                <div
                  className="h-full bg-primary transition-[width] duration-75"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground w-8 shrink-0">
                {formatTime(duration)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
              Пробел — пауза · ←/→ — ±5 с · Ctrl+←/→ — трек · ↑/↓ — громкость · M — без звука
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 flex-shrink-0 w-[100px] sm:w-[140px] md:w-[160px] min-w-0"
            title={`Громкость ${Math.round(volume * 100)}%`}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Включить звук' : 'Без звука'}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
                setMuted(false);
              }}
              className="w-full min-w-0 h-1.5 flex-1 cursor-pointer accent-primary disabled:opacity-50"
              aria-label="Громкость"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(volume * 100)}
            />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => handlePrev()}
              aria-label="Предыдущий"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full"
              disabled={loading || !audioUrl}
              onClick={() => setPlaying(!isPlaying)}
              aria-label={isPlaying ? 'Пауза' : 'Играть'}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => handleNext()}
              aria-label="Следующий"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={() => {
                close();
                if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.src = '';
                }
              }}
              aria-label="Закрыть плеер"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      )}
      <audio ref={audioRef} className="hidden" preload="metadata" playsInline />
    </>
  );
}
