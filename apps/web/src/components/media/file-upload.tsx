'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, FileIcon, CheckCircle, Music, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { uploadFile } from '@/lib/upload';
import { getErrorMessage } from '@/lib/api';
import { formatFileSize, cn } from '@/lib/utils';
import { compressImageFileIfNeeded } from '@/lib/image-compress';
import { ImageCropDialog } from '@/components/media/image-crop-dialog';

type MediaContentType = 'image' | 'video' | 'audio' | 'voice' | 'document';

interface QueuedFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

function getContentType(file: File): MediaContentType {
  const t = file.type.toLowerCase();
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  return 'document';
}

interface Props {
  chatId?: string;
  onUploaded: (mediaId: string, url: string, contentType: MediaContentType, caption?: string) => void;
  onClose: () => void;
}

export function FileUpload({ chatId, onUploaded, onClose }: Props) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [caption, setCaption] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const captionRef = useRef('');
  const singleFileBatchRef = useRef(true);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOriginalName, setCropOriginalName] = useState('');

  const closeCrop = useCallback(() => {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCropOpen(false);
    setCropOriginalName('');
  }, []);

  const handleFile = useCallback((f: File) => {
    void (async () => {
      let file = f;
      try {
        if (f.type.startsWith('image/')) {
          file = await compressImageFileIfNeeded(f);
        }
      } catch {
        file = f;
      }
      const id = `${file.name}-${file.size}-${file.lastModified}`;
      setQueue((prev) => {
        if (prev.some((item) => item.id === id)) return prev;
        const next = [...prev, { file, id, status: 'pending' as const, progress: 0 }];
        singleFileBatchRef.current = next.length === 1;
        if (next.length > 1) {
          captionRef.current = '';
          setCaption('');
        }
        return next;
      });
    })();
  }, []);

  /** Одно фото — сначала кадрирование (как в историях), несколько файлов — сразу в очередь. */
  const routeIncomingFiles = useCallback(
    (files: File[]) => {
      if (files.length === 1 && files[0].type.startsWith('image/')) {
        const f = files[0];
        setCropOriginalName(f.name);
        setCropSrc(URL.createObjectURL(f));
        setCropOpen(true);
        return;
      }
      files.forEach((f) => handleFile(f));
    },
    [handleFile],
  );

  const handleCroppedImage = useCallback(
    async (blob: Blob) => {
      const base = cropOriginalName.replace(/\.[^.]+$/, '') || 'photo';
      const ext = blob.type.includes('png') ? 'png' : 'jpeg';
      const file = new File([blob], `${base}.${ext}`, {
        type: blob.type || 'image/jpeg',
      });
      handleFile(file);
      /* onClose вызывается из ImageCropDialog после onCropped — там же revoke URL */
    },
    [cropOriginalName, handleFile],
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;

    const pendingItem = queue.find((item) => item.status === 'pending');
    if (!pendingItem) return;

    processingRef.current = true;
    const itemId = pendingItem.id;

    setQueue((prev) =>
      prev.map((q) => (q.id === itemId ? { ...q, status: 'uploading' as const } : q))
    );

    try {
      const media = await uploadFile(pendingItem.file, chatId, (progress) => {
        setQueue((prev) =>
          prev.map((q) => (q.id === itemId ? { ...q, progress } : q))
        );
      });
      const cap = singleFileBatchRef.current ? captionRef.current.trim() : undefined;
      onUploaded(media.id, media.url, getContentType(pendingItem.file), cap);

      setQueue((prev) =>
        prev.map((q) =>
          q.id === itemId ? { ...q, status: 'completed' as const, progress: 100 } : q
        )
      );
    } catch (err: unknown) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === itemId
            ? { ...q, status: 'error' as const, error: getErrorMessage(err) || 'Ошибка загрузки' }
            : q
        )
      );
    }

    processingRef.current = false;
  }, [queue, chatId, onUploaded]);

  useEffect(() => {
    const hasPending = queue.some((item) => item.status === 'pending');
    if (hasPending && !processingRef.current) {
      processQueue();
    }
  }, [queue, processQueue]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      routeIncomingFiles(files);
    },
    [routeIncomingFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      routeIncomingFiles(files);
      e.target.value = '';
    },
    [routeIncomingFiles],
  );

  const removeFile = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const retryFile = useCallback(
    (id: string) => {
      setQueue((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: 'pending' as const, error: undefined } : q))
      );
    },
    []
  );

  const allCompleted = queue.length > 0 && queue.every((item) => item.status === 'completed');
  const hasUploading = queue.some((item) => item.status === 'uploading');
  const hasPending = queue.some((item) => item.status === 'pending');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="p-3 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          {queue.length > 1
            ? `Загрузка файлов (${queue.length})`
            : 'Загрузка файла'}
        </h3>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {queue.length === 0 ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 px-4 cursor-pointer transition-all',
              dragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-primary/50'
            )}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-center">
              Перетащите файлы или нажмите. Фото можно обрезать перед отправкой.
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleFileSelect}
            />
          </motion.div>
        ) : (
          <motion.div
            key="file-list"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-2"
          >
            {queue.length === 1 && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Подпись (необязательно)</p>
                <Textarea
                  value={caption}
                  placeholder="Подпись: **жирный**, __курсив__, `код`, ссылки https://…"
                  rows={2}
                  className="min-h-[60px] resize-none rounded-xl text-sm"
                  onChange={(e) => {
                    const v = e.target.value;
                    setCaption(v);
                    captionRef.current = v;
                  }}
                />
              </div>
            )}
            {queue.map((item, index) => {
              const ct = getContentType(item.file);
              const isCurrent = item.status === 'uploading';
              const isPending = item.status === 'pending';

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3',
                    item.status === 'error' ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                  )}
                >
                  {item.status === 'completed' ? (
                    <CheckCircle className="h-6 w-6 text-success flex-shrink-0" />
                  ) : item.status === 'error' ? (
                    <X className="h-6 w-6 text-destructive flex-shrink-0" />
                  ) : item.status === 'uploading' ? (
                    <Loader2 className="h-6 w-6 text-primary animate-spin flex-shrink-0" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                      {index + 1}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{item.file.name}</p>
                      {isCurrent && (
                        <span className="text-xs text-muted-foreground">{item.progress}%</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{formatFileSize(item.file.size)}</p>
                      {item.status === 'error' && (
                        <span className="text-xs text-destructive">{item.error}</span>
                      )}
                    </div>
                    {(item.status === 'uploading' || item.status === 'pending') && (
                      <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className="h-full gradient-primary rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${item.progress}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                    )}
                  </div>

                  {item.status === 'error' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={() => retryFile(item.id)}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  ) : item.status !== 'uploading' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={() => removeFile(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {allCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-success"
          >
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Все файлы загружены</span>
          </motion.div>
        )}
      </AnimatePresence>

      {(hasUploading || hasPending) && (
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button disabled className="w-full rounded-xl gradient-primary border-0 text-white opacity-50 cursor-not-allowed">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Загрузка...
          </Button>
        </motion.div>
      )}

      {allCompleted && (
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button onClick={onClose} className="w-full rounded-xl gradient-primary border-0 text-white">
            Закрыть
          </Button>
        </motion.div>
      )}

      <ImageCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        title="Кадрирование фото"
        onClose={closeCrop}
        onCropped={handleCroppedImage}
      />
    </motion.div>
  );
}
