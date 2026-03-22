'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Trash2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Обрезает аудио blob по заданному диапазону [startSec, endSec] */
async function trimAudioBlob(blob: Blob, startSec: number, endSec: number): Promise<Blob> {
  if (startSec <= 0 && endSec >= 1e6) return blob;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const sampleRate = decoded.sampleRate;
    const startSample = Math.floor(Math.max(0, startSec) * sampleRate);
    const endSample = Math.min(Math.floor(endSec * sampleRate), decoded.length);
    const length = Math.max(0, endSample - startSample);
    if (length <= 0) return blob;

    const trimmedBuffer = audioContext.createBuffer(decoded.numberOfChannels, length, sampleRate);
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const src = decoded.getChannelData(ch);
      const dest = trimmedBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) dest[i] = src[startSample + i];
    }

    const dest = audioContext.createMediaStreamDestination();
    const source = audioContext.createBufferSource();
    source.buffer = trimmedBuffer;
    source.connect(dest);
    source.start(0);

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
    const recorder = mime ? new MediaRecorder(dest.stream, { mimeType: mime }) : new MediaRecorder(dest.stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start(100);

    await new Promise<void>((resolve) => {
      const done = () => {
        try { recorder.state === 'recording' && recorder.stop(); } catch {}
        resolve();
      };
      source.onended = done;
      setTimeout(done, (length / sampleRate) * 1000 + 600);
    });

    const result = new Blob(chunks, { type: mime });
    await audioContext.close();
    return result;
  } catch {
    return blob;
  }
}

interface Props {
  blob: Blob;
  durationSec: number;
  onSend: (blob: Blob) => void;
  onCancel: () => void;
}

export function VoicePreviewPanel({ blob, durationSec, onSend, onCancel }: Props) {
  const safeDuration = Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0;
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(safeDuration);
  const [isSending, setIsSending] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      if (Number.isFinite(trimStart)) {
        audio.currentTime = Math.max(0, trimStart);
      }
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, trimStart]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      if (audio.currentTime >= trimEnd - 0.05) {
        audio.pause();
        if (Number.isFinite(trimStart)) {
          audio.currentTime = Math.max(0, trimStart);
        }
        setIsPlaying(false);
      }
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [trimStart, trimEnd]);

  const handleSend = useCallback(async () => {
    setIsSending(true);
    try {
      const trimmed =
        trimStart > 0.1 || trimEnd < safeDuration - 0.1
          ? await trimAudioBlob(blob, trimStart, trimEnd)
          : blob;
      onSend(trimmed);
    } finally {
      setIsSending(false);
    }
  }, [blob, trimStart, trimEnd, safeDuration, onSend]);

  const trimmedDuration = Math.max(0.1, trimEnd - trimStart);
  const minGap = Math.max(0.1, Math.min(0.5, safeDuration * 0.2));

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex flex-col gap-3 px-4 py-3 bg-secondary/50 rounded-xl mx-2 mb-2 overflow-hidden"
    >
      <p className="text-xs text-muted-foreground">Запись завершена. Обрежьте при необходимости.</p>
      {previewUrl && (
        <div className="flex items-center gap-2">
          <audio ref={audioRef} src={previewUrl} onTimeUpdate={() => {}} />
          <Button variant="outline" size="sm" onClick={togglePlay} className="gap-2">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying ? 'Пауза' : 'Прослушать'}
          </Button>
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Начало: {formatTime(trimStart)}</span>
          <span>Длина: {formatTime(trimmedDuration)}</span>
          <span>Конец: {formatTime(trimEnd)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full relative overflow-hidden flex">
          <div className="h-full bg-muted-foreground/20 rounded-l-full" style={{ width: `${(trimStart / Math.max(0.01, durationSec)) * 100}%` }} />
          <div className="h-full bg-primary" style={{ width: `${((trimEnd - trimStart) / Math.max(0.01, durationSec)) * 100}%` }} />
          <div className="h-full bg-muted-foreground/20 rounded-r-full" style={{ width: `${((safeDuration - trimEnd) / Math.max(0.01, safeDuration)) * 100}%` }} />
        </div>
        <div className="flex gap-4 text-xs">
          <label className="flex-1">
            <span className="text-muted-foreground block mb-0.5">От начала</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, safeDuration - minGap)}
              step={0.1}
              value={trimStart}
              onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd - minGap))}
              className="w-full"
            />
          </label>
          <label className="flex-1">
            <span className="text-muted-foreground block mb-0.5">До конца</span>
            <input
              type="range"
              min={minGap}
              max={safeDuration}
              step={0.1}
              value={trimEnd}
              onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart + minGap))}
              className="w-full"
            />
          </label>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-destructive"
          onClick={onCancel}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          className="h-9 w-9 gradient-primary border-0 text-white"
          onClick={handleSend}
          disabled={isSending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
