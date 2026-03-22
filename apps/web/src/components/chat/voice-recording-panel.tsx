'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, Send, Trash2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CircularProgress } from './circular-progress';
import { useAudioVisualizer } from '@/hooks/use-audio-visualizer';

const WAVEFORM_BARS = 32;
const MAX_DURATION_SEC = 60;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  isPaused: boolean;
  isRecording: boolean;
  durationSec: number;
  mediaStream: MediaStream | null;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onSend: () => void;
}

export function VoiceRecordingPanel({
  isPaused,
  isRecording,
  durationSec,
  mediaStream,
  onPause,
  onResume,
  onCancel,
  onSend,
}: Props) {
  const barsRef = useRef<number[]>(Array.from({ length: WAVEFORM_BARS }, () => 0.3 + Math.random() * 0.7));

  // Хук визуализации аудио
  const { barHeights, canvasRef } = useAudioVisualizer({
    mediaStream,
    barCount: WAVEFORM_BARS,
    enabled: isRecording && !isPaused,
  });

  const isMaxReached = durationSec >= MAX_DURATION_SEC;
  const progress = Math.min(durationSec / MAX_DURATION_SEC, 1);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'mx-2 mb-2 overflow-hidden rounded-2xl border border-border/70 bg-card/95 px-3 py-2'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span className="text-foreground">Запись голоса</span>
          {isPaused && <span className="text-xs text-muted-foreground">на паузе</span>}
        </div>
        <span className="text-sm font-semibold tabular-nums text-foreground">{formatTime(durationSec)}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <CircularProgress
            progress={progress}
            size={56}
            strokeWidth={3}
          >
            <div className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200',
              isPaused ? 'bg-primary/20' : 'bg-red-500/20'
            )}>
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full',
                isPaused ? 'bg-primary' : 'bg-red-500'
              )}>
                <Mic className="h-4 w-4 text-white" />
              </div>
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

        <div className="relative flex h-9 flex-1 items-center rounded-xl bg-secondary/70 px-2">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full rounded-xl"
            style={{ display: isRecording && !isPaused ? 'block' : 'none' }}
          />
          {(!isRecording || isPaused) && (
            <div className="flex h-full w-full items-center gap-[2px]">
              {Array.from({ length: WAVEFORM_BARS }).map((_, i) => (
                <div
                  key={i}
                  className={cn('w-1 rounded-full transition-colors', isPaused ? 'bg-muted-foreground/40' : 'bg-primary/50')}
                  style={{ height: `${Math.max(4, (barsRef.current[i] ?? 0.5) * 100)}%` }}
                />
              ))}
            </div>
          )}
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
