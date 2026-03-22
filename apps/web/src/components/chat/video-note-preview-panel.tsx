'use client';

import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Trash2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CircularProgress } from './circular-progress';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  blob: Blob;
  durationSec: number;
  onSend: (blob: Blob) => void;
  onCancel: () => void;
}

export function VideoNotePreviewPanel({ blob, durationSec, onSend, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const handleSend = () => {
    onSend(blob);
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex flex-col items-center gap-4 px-4 py-6 bg-secondary/50 rounded-xl mx-2 mb-2 overflow-hidden"
    >
      <p className="text-sm font-medium text-muted-foreground">Видеосообщение готово</p>
      
      <div className="flex items-center gap-4">
        {/* Круглое превью с кнопкой play */}
        <div className="relative">
          <CircularProgress
            progress={1}
            size={140}
            strokeWidth={4}
          >
            <div className="w-28 h-28 rounded-full overflow-hidden bg-black ring-4 ring-primary/30">
              <video
                ref={videoRef}
                src={url ?? undefined}
                className="w-full h-full object-cover"
                playsInline
                muted
                loop
                onEnded={handleEnded}
              />
            </div>
          </CircularProgress>
          
          {/* Кнопка Play/Pause */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handlePlayPause}
            className="absolute inset-0 flex items-center justify-center w-28 h-28 m-auto rounded-full bg-black/40"
          >
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="h-6 w-6 text-foreground ml-1 fill-current" />
            </div>
          </motion.button>
        </div>

        <div className="flex-1">
          <div className="flex flex-col gap-2">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {formatTime(durationSec)}
            </span>
            <p className="text-sm text-muted-foreground">
              Нажмите, чтобы просмотреть
            </p>
          </div>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleCancel}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          className="h-10 w-10 rounded-full gradient-primary border-0 text-white shadow-md"
          onClick={handleSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
