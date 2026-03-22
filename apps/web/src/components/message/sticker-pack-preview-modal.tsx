'use client';

import { usePackByStickerMediaId, useAddPackToMe } from '@/hooks/use-sticker-packs';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';

interface Props {
  stickerMediaId: string | null;
  onClose: () => void;
}

/** Модалка при клике на стикер в сообщении: показывает пак и кнопку «Добавить себе». */
export function StickerPackPreviewModal({ stickerMediaId, onClose }: Props) {
  const { data: pack, isLoading } = usePackByStickerMediaId(stickerMediaId);
  const addToMe = useAddPackToMe();

  if (!stickerMediaId) return null;

  const handleAdd = async () => {
    if (!pack?.id) return;
    await addToMe.mutateAsync(pack.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Пак стикеров"
    >
      <div
        className="bg-card border border-border rounded-xl shadow-xl p-4 min-w-[200px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Загрузка...</span>
          </div>
        ) : pack ? (
          <div className="space-y-3">
            <p className="font-medium text-sm">Пак: {pack.name}</p>
            {!pack.addedToMe && pack.isPublic && (
              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={handleAdd}
                disabled={addToMe.isPending}
              >
                {addToMe.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Добавить себе
              </Button>
            )}
            {pack.addedToMe && (
              <p className="text-xs text-muted-foreground">У вас уже есть этот пак</p>
            )}
            {!pack.isPublic && !pack.addedToMe && (
              <p className="text-xs text-muted-foreground">Пак не публичный</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">Пак не найден</p>
        )}
        <Button variant="ghost" size="sm" className="w-full mt-2" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </div>
  );
}
