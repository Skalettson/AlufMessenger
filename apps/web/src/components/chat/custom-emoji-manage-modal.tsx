'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useMyCustomEmoji,
  usePublicCustomEmoji,
  useCreateCustomEmoji,
  useAddEmojiToMe,
  useRemoveEmojiFromMe,
  useDeleteCustomEmoji,
} from '@/hooks/use-custom-emoji';
import { uploadFile } from '@/lib/upload';
import { getErrorMessage } from '@/lib/api';
import { useMediaUrlWithType } from '@/hooks/use-media-url';
import { MediaImageOrVideo } from '@/components/shared/media-image-or-video';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

function EmojiThumb({ mediaId, shortcode, size = 32 }: { mediaId: string; shortcode: string; size?: number }) {
  const { url, mimeType } = useMediaUrlWithType(mediaId);
  if (!url) return <div className={cn('rounded bg-secondary/50 animate-pulse', `w-${size} h-${size}`)} style={{ width: size, height: size }} />;
  return <MediaImageOrVideo url={url} mimeType={mimeType} alt={shortcode} className="object-contain rounded" style={{ width: size, height: size }} />;
}

interface CustomEmojiManageModalProps {
  onClose?: () => void;
  chatId?: string;
  /** Встроенный режим для страницы настроек (без оверлея). */
  embedded?: boolean;
}

export function CustomEmojiManageModal({ onClose, chatId, embedded }: CustomEmojiManageModalProps) {
  const [tab, setTab] = useState<'my' | 'create' | 'catalog'>('my');
  const [shortcode, setShortcode] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = useAuthStore((s) => s.user?.id);

  const { data: myEmoji = [], isLoading: myLoading } = useMyCustomEmoji();
  const { data: publicEmoji = [], isLoading: publicLoading } = usePublicCustomEmoji(tab === 'catalog' ? search : undefined, 30, 0);
  const createEmoji = useCreateCustomEmoji();
  const addToMe = useAddEmojiToMe();
  const removeFromMe = useRemoveEmojiFromMe();
  const deleteEmoji = useDeleteCustomEmoji();

  const myCreated = myEmoji.filter((e) => e.creatorId); // simplified: we don't have "isMine" on item, so all in "my" are mine or added
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = shortcode.trim();
    const normalized = code.startsWith(':') && code.endsWith(':') ? code : `:${code}:`;
    if (!fileInputRef.current?.files?.[0]) {
      setError('Выберите изображение');
      return;
    }
    setUploading(true);
    try {
      const file = fileInputRef.current.files[0];
      const media = await uploadFile(file, chatId);
      await createEmoji.mutateAsync({ mediaId: media.id, shortcode: normalized });
      setShortcode('');
      setTab('my');
      setSelectedFileName(null);
      fileInputRef.current.value = '';
    } catch (err) {
      setError(getErrorMessage(err) || 'Ошибка создания эмодзи');
    } finally {
      setUploading(false);
    }
  };

  const inner = (
    <>
        <div className="flex gap-1 p-2 border-b border-border">
          {(['my', 'create', 'catalog'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                tab === t ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'my' ? 'Мои' : t === 'create' ? 'Создать' : 'Каталог'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="text-sm text-destructive mb-2">{error}</p>}

          {tab === 'my' && (
            <>
              {myLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : myEmoji.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Нет эмодзи. Создайте или добавьте из каталога.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {myEmoji.map((e) => (
                    <div key={e.id} className="flex flex-col items-center gap-1">
                      <EmojiThumb mediaId={e.mediaId} shortcode={e.shortcode} size={40} />
                      <span className="text-xs text-muted-foreground truncate max-w-[80px]">{e.shortcode}</span>
                      {e.creatorId === userId ? (
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => deleteEmoji.mutate(e.id)}>
                          Удалить
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => removeFromMe.mutate(e.id)}>
                          Убрать
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'create' && (
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Короткий код (например :smile:)</label>
                <input
                  type="text"
                  value={shortcode}
                  onChange={(e) => setShortcode(e.target.value)}
                  placeholder=":my_emoji:"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Изображение</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/webm"
                  className="sr-only"
                  onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name ?? null)}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Обзор...
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedFileName ?? 'Файл не выбран.'}
                  </span>
                </div>
              </div>
              <Button type="submit" disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Создать эмодзи
              </Button>
            </form>
          )}

          {tab === 'catalog' && (
            <>
              <input
                type="text"
                placeholder="Поиск по коду..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mb-3 outline-none focus:ring-2 focus:ring-primary/20"
              />
              {publicLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : publicEmoji.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Нет публичных эмодзи</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {publicEmoji.map((e) => (
                    <div key={e.id} className="flex flex-col items-center gap-1">
                      <EmojiThumb mediaId={e.mediaId} shortcode={e.shortcode} size={40} />
                      <span className="text-xs text-muted-foreground truncate max-w-[80px]">{e.shortcode}</span>
                      <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => addToMe.mutate(e.id)}>
                        Добавить
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Мои эмодзи</h2>
        {inner}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-md max-h-[85vh] overflow-hidden rounded-xl bg-card border border-border shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">Мои эмодзи</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {inner}
      </motion.div>
    </motion.div>
  );
}
