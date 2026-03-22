'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Video, Maximize2 } from 'lucide-react';
import { useMediaUrl } from '@/hooks/use-media-url';
import { cn, pickMediaUrl } from '@/lib/utils';

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
  onExpand?: () => void;
}

export function VideoNotePlayer({ url, mediaId, isMine, onExpand }: Props) {
  const proxiedUrl = useMediaUrl(mediaId ?? null);
  const playUrl = pickMediaUrl(proxiedUrl, url, !!mediaId);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playUrl) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [playUrl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.pause();
    else video.play();
  };

  if (!playUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center w-40 h-40 rounded-full overflow-hidden',
          isMine ? 'bg-white/20' : 'bg-muted',
        )}
      >
        <Video className="h-10 w-10 text-muted-foreground" />
      </div>
    );
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          'relative w-40 h-40 rounded-full overflow-hidden',
          'focus:outline-none focus:ring-2 focus:ring-primary/50',
          'flex items-center justify-center',
        )}
      >
        <video
          ref={videoRef}
          src={playUrl}
          className="w-full h-full object-cover"
          playsInline
          muted={false}
          preload="metadata"
        />
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center',
                isMine ? 'bg-white/30' : 'bg-primary/20',
              )}
            >
              <Play className="h-7 w-7 fill-current text-white ml-1" />
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
          <div
            className={cn('h-full transition-all duration-100', isMine ? 'bg-white/90' : 'bg-primary')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </button>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-xs font-medium tabular-nums',
            isMine ? 'text-white/90' : 'text-muted-foreground',
          )}
        >
          {isPlaying ? formatDuration(currentTime) : formatDuration(duration)}
        </span>
        {onExpand && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="p-1 rounded hover:bg-black/20 text-muted-foreground hover:text-foreground transition-colors"
            title="Открыть в полном размере"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
