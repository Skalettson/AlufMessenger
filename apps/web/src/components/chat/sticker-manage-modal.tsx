'use client';

import { useState, useRef, useDeferredValue } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Upload, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useMyStickerPacks,
  usePublicStickerPacks,
  useCreateStickerPack,
  useAddStickerToPack,
  useDeleteStickerPack,
  useRemoveStickerFromPack,
  usePackWithStickers,
  useAddPackToMe,
  useRemovePackFromMe,
  type StickerPack,
} from '@/hooks/use-sticker-packs';
import { uploadFile } from '@/lib/upload';
import { getErrorMessage } from '@/lib/api';
import { useMediaUrlWithType } from '@/hooks/use-media-url';
import { MediaImageOrVideo } from '@/components/shared/media-image-or-video';
function CatalogPackThumb({ pack }: { pack: StickerPack }) {
  const id = (pack.previewMediaId || pack.coverMediaId || '').trim();
  const { url, mimeType } = useMediaUrlWithType(id || null);
  if (!id || !url) {
    return <div className="h-10 w-10 rounded-lg bg-secondary/80 shrink-0" aria-hidden />;
  }
  return (
    <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-border">
      <MediaImageOrVideo url={url} mimeType={mimeType} className="w-full h-full" />
    </div>
  );
}

function StickerThumb({ mediaId, onRemove }: { mediaId: string; onRemove?: () => void }) {
  const { url, mimeType } = useMediaUrlWithType(mediaId);
  if (!url) return <div className="w-14 h-14 rounded bg-secondary/50 animate-pulse" />;
  return (
    <div className="relative group">
      <MediaImageOrVideo url={url} mimeType={mimeType} className="w-14 h-14 rounded border border-border" />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute inset-0 flex items-center justify-center bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs"
        >
          Удалить
        </button>
      )}
    </div>
  );
}

interface StickerManageModalProps {
  onClose?: () => void;
  chatId?: string;
  /** Встроенный режим для страницы настроек (без оверлея). */
  embedded?: boolean;
}

export function StickerManageModal({ onClose, chatId, embedded }: StickerManageModalProps) {
  const [packName, setPackName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [addingSticker, setAddingSticker] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ packId: string; done: number; total: number; errors: string[] } | null>(null);
  const [packIdForUpload, setPackIdForUpload] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILES = 50;

  const deferredCatalogSearch = useDeferredValue(catalogSearch.trim());
  const { data: publicPacks = [], isLoading: catalogLoading } = usePublicStickerPacks(
    deferredCatalogSearch || undefined,
    40,
    0,
  );
  const addPackToMe = useAddPackToMe();
  const removePackFromMe = useRemovePackFromMe();

  const { data: myPacks = [], isLoading } = useMyStickerPacks();
  const createPack = useCreateStickerPack();
  const addStickerToPack = useAddStickerToPack();
  const deletePack = useDeleteStickerPack();
  const removeStickerFromPack = useRemoveStickerFromPack();
  const { data: packWithStickers } = usePackWithStickers(selectedPackId);
  const myPacksOnly = myPacks.filter((p) => p.isMine);

  async function handleCreatePack(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const name = packName.trim();
    if (!name) {
      setError('Введите название пака');
      return;
    }
    setCreating(true);
    try {
      await createPack.mutateAsync({ name, isPublic });
      setPackName('');
      setCreating(false);
    } catch (err) {
      setError(getErrorMessage(err) || 'Ошибка создания пака');
      setCreating(false);
    }
  }

  async function handleAddStickers(files: FileList | File[]) {
    const pid = packIdForUpload;
    setPackIdForUpload(null);
    if (!pid) return;
    const list = Array.from(files).slice(0, MAX_FILES);
    if (list.length === 0) return;
    setError('');
    setAddingSticker(true);
    setUploadProgress({ packId: pid, done: 0, total: list.length, errors: [] });
    const errors: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const media = await uploadFile(file, chatId);
        await addStickerToPack.mutateAsync({ packId: pid, mediaId: media.id });
      } catch (err) {
        const msg = getErrorMessage(err) || 'Ошибка';
        errors.push(`${file.name}: ${msg}`);
      }
      setUploadProgress((p) => p ? { ...p, done: i + 1, errors } : null);
    }
    setAddingSticker(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (errors.length > 0) {
      setError(`Добавлено ${list.length - errors.length} из ${list.length}. Ошибки: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` и ещё ${errors.length - 3}` : ''}`);
    }
  }

  const catalogSection = (
    <section className="rounded-xl border border-border bg-muted/25 p-4 space-y-3" aria-labelledby="sticker-catalog-heading">
      <div>
        <h3 id="sticker-catalog-heading" className="text-sm font-semibold text-foreground">
          Публичный каталог
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Поиск по названию. Добавленные паки появятся в пикере стикеров в чате.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
        <input
          type="search"
          placeholder="Поиск в каталоге..."
          value={catalogSearch}
          onChange={(e) => {
            setCatalogSearch(e.target.value);
            setCatalogError('');
          }}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoComplete="off"
        />
      </div>
      {catalogError ? <p className="text-xs text-destructive">{catalogError}</p> : null}
      <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5">
        {catalogLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : publicPacks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {catalogSearch.trim() ? 'Ничего не найдено' : 'Публичных паков пока нет'}
          </p>
        ) : (
          publicPacks.map((pack) => (
            <div
              key={pack.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <CatalogPackThumb pack={pack} />
                <span className="truncate text-sm font-medium">{pack.name}</span>
              </div>
              {pack.isPublic &&
                (pack.addedToMe ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs shrink-0"
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
                    className="h-7 text-xs shrink-0"
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
                ))}
            </div>
          ))
        )}
      </div>
    </section>
  );

  const managementSection = (
    <>
      <form onSubmit={handleCreatePack} className="flex gap-2">
            <input
              type="text"
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              placeholder="Название пака"
              className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="rounded" />
              Публичный
            </label>
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </form>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/webm"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) handleAddStickers(files);
            }}
          />

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : myPacksOnly.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Создайте пак выше и добавьте в него стикеры.</p>
          ) : (
            <div className="space-y-3">
              {myPacksOnly.map((pack) => (
                <div key={pack.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPackId(selectedPackId === pack.id ? null : pack.id)}
                      className="font-medium text-sm"
                    >
                      {pack.name}
                      {pack.isPublic && <span className="text-muted-foreground text-xs ml-1">(публичный)</span>}
                    </button>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setPackIdForUpload(pack.id);
                          setError('');
                          setTimeout(() => fileInputRef.current?.click(), 0);
                        }}
                        disabled={addingSticker}
                      >
                        {addingSticker && uploadProgress?.packId === pack.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            {uploadProgress.done} / {uploadProgress.total}
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            Добавить (до {MAX_FILES})
                          </>
                        )}
                      </Button>
                      {uploadProgress?.packId === pack.id && (
                        <span className="text-xs text-muted-foreground self-center">
                          Добавление стикеров...
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => deletePack.mutate(pack.id)}
                      >
                        Удалить пак
                      </Button>
                    </div>
                  </div>
                  {selectedPackId === pack.id && packWithStickers?.pack?.id === pack.id && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {packWithStickers.stickers.map((s) => (
                        <StickerThumb
                          key={s.mediaId}
                          mediaId={s.mediaId}
                          onRemove={() => removeStickerFromPack.mutate({ packId: pack.id, mediaId: s.mediaId })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        {catalogSection}
        <h2 className="text-lg font-semibold">Мои стикеры</h2>
        <div className="space-y-4">{managementSection}</div>
      </div>
    );
  }

  const content = (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">Стикеры</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {catalogSection}
        <h3 className="text-sm font-semibold text-foreground">Мои стикеры</h3>
        {managementSection}
      </div>
    </>
  );

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
        {content}
      </motion.div>
    </motion.div>
  );
}
