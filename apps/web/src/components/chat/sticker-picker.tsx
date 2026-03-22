'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/api';
import { useMediaUrlWithType } from '@/hooks/use-media-url';
import { MediaImageOrVideo } from '@/components/shared/media-image-or-video';
import {
  useMyStickerPacks,
  usePublicStickerPacks,
  usePackWithStickers,
  useAddPackToMe,
  useRemovePackFromMe,
  type StickerPack,
  type StickerItem,
} from '@/hooks/use-sticker-packs';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';

function PackPreviewThumb({ pack }: { pack: StickerPack }) {
  const id = (pack.previewMediaId || pack.coverMediaId || '').trim();
  if (!id) {
    return <div className="h-10 w-10 rounded-lg bg-secondary/80 shrink-0" aria-hidden />;
  }
  return <StickerImage mediaId={id} className="h-10 w-10 shrink-0 rounded-lg" />;
}

function StickerImage({ mediaId, mimeType, className, onClick }: { mediaId: string; mimeType?: string; className?: string; onClick?: () => void }) {
  const { url, mimeType: resolvedType } = useMediaUrlWithType(mediaId);
  const type = mimeType ?? resolvedType;
  if (!url) return <div className={cn('bg-secondary/50 animate-pulse rounded-lg', className)} />;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded-lg overflow-hidden hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary/50', className)}
    >
      <MediaImageOrVideo url={url} mimeType={type} className="w-full h-full" />
    </button>
  );
}

interface StickerPickerProps {
  onSelectSticker: (mediaId: string) => void;
  /** Встроенный режим: без обёртки карточки и без кнопки «Создать». */
  embedded?: boolean;
}

export function StickerPicker({ onSelectSticker, embedded }: StickerPickerProps) {
  const [tab, setTab] = useState<'my' | 'catalog'>('my');
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [catalogError, setCatalogError] = useState('');

  const { data: myPacks = [], isLoading: myLoading } = useMyStickerPacks();
  const { data: publicPacks = [], isLoading: publicLoading } = usePublicStickerPacks(
    tab === 'catalog' ? search : undefined,
    30,
    0,
  );
  const { data: packWithStickers, isLoading: packLoading } = usePackWithStickers(selectedPackId);
  const addPackToMe = useAddPackToMe();
  const removePackFromMe = useRemovePackFromMe();

  const packs = tab === 'my' ? myPacks : publicPacks;
  const isLoading = tab === 'my' ? myLoading : publicLoading;
  const stickers: StickerItem[] = packWithStickers?.stickers ?? [];
  const showPackList = selectedPackId == null;

  return (
    <div className={cn(embedded ? 'min-w-0' : 'w-80 rounded-2xl border border-border bg-card p-3 shadow-xl')}>
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => { setTab('my'); setSelectedPackId(null); }}
          className={cn(
            'relative px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
            tab === 'my' ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Мои
          {tab === 'my' && (
            <motion.div layoutId="sticker-tab" className="absolute inset-0 bg-primary/10 rounded-lg -z-10" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
          )}
        </button>
        <button
          type="button"
          onClick={() => { setTab('catalog'); setSelectedPackId(null); }}
          className={cn(
            'relative px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
            tab === 'catalog' ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Каталог
          {tab === 'catalog' && (
            <motion.div layoutId="sticker-tab" className="absolute inset-0 bg-primary/10 rounded-lg -z-10" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
          )}
        </button>
      </div>

      {tab === 'catalog' && showPackList && (
        <div className="mb-2 space-y-1">
          <div className="flex items-center gap-1 rounded-lg bg-secondary/50 px-2 py-1">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Поиск паков..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCatalogError(''); }}
              className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {catalogError ? (
            <p className="text-[11px] text-destructive px-0.5">{catalogError}</p>
          ) : null}
        </div>
      )}

      {showPackList ? (
        <div className="max-h-52 overflow-y-auto space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : packs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {tab === 'my' ? 'Нет паков. Создайте пак и добавьте стикеры.' : 'Нет публичных паков.'}
            </p>
          ) : (
            packs.map((pack: StickerPack) => (
              <div
                key={pack.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-secondary/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setSelectedPackId(pack.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <PackPreviewThumb pack={pack} />
                  <span className="truncate text-sm font-medium">{pack.name}</span>
                </button>
                {tab === 'catalog' && pack.isPublic && (
                  pack.addedToMe ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs shrink-0"
                      onClick={() => {
                        setCatalogError('');
                        removePackFromMe.mutate(pack.id);
                      }}
                    >
                      Убрать
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs shrink-0"
                      disabled={addPackToMe.isPending}
                      onClick={async () => {
                        setCatalogError('');
                        try {
                          await addPackToMe.mutateAsync(pack.id);
                        } catch (err: unknown) {
                          setCatalogError(getErrorMessage(err) || 'Не удалось добавить пак');
                        }
                      }}
                    >
                      Добавить
                    </Button>
                  )
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setSelectedPackId(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Назад к пакам
          </button>
          {packLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stickers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">В паке нет стикеров</p>
          ) : (
            <div className="grid grid-cols-4 gap-1 max-h-52 overflow-y-auto">
              {stickers.map((s) => (
                <StickerImage
                  key={s.mediaId}
                  mediaId={s.mediaId}
                  mimeType={s.mimeType}
                  className="h-16 w-16"
                  onClick={() => onSelectSticker(s.mediaId)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
