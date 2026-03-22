'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMediaUrlWithType } from '@/hooks/use-media-url';
import { MediaImageOrVideo } from '@/components/shared/media-image-or-video';
import { cn } from '@/lib/utils';
import { X, GripVertical } from 'lucide-react';

export type StickerLayerState = {
  id: string;
  mediaId: string;
  nx: number;
  ny: number;
  nWidth: number;
  rotation: number;
};

export type TextLayerState = {
  id: string;
  text: string;
  nx: number;
  ny: number;
  nFont: number;
  color: string;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function StickerThumb({
  mediaId,
  nWidth,
  rotation,
  selected,
  onPointerDown,
}: {
  mediaId: string;
  nWidth: number;
  rotation: number;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const { url, mimeType } = useMediaUrlWithType(mediaId);
  if (!url) {
    return (
      <div
        data-sticker="1"
        className={cn('animate-pulse rounded-lg bg-white/10', selected && 'ring-2 ring-sky-400')}
        style={{ width: `${nWidth * 100}%`, aspectRatio: '1' }}
        onPointerDown={onPointerDown}
      />
    );
  }
  return (
    <div
      data-sticker="1"
      className={cn('touch-none select-none', selected && 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black/50 rounded-lg')}
      style={{
        width: `${nWidth * 100}%`,
        transform: `rotate(${rotation}deg)`,
      }}
      onPointerDown={onPointerDown}
    >
      <MediaImageOrVideo url={url} mimeType={mimeType ?? undefined} className="h-full w-full object-contain drop-shadow-lg" />
    </div>
  );
}

type DragPayload = {
  id: string;
  kind: 'sticker' | 'text';
  startX: number;
  startY: number;
  startNx: number;
  startNy: number;
  rect: DOMRect;
};

export function StoryEditorLayers({
  containerRef,
  stickerLayers,
  textLayers,
  selectedId,
  setSelectedId,
  onStickerMove,
  onTextMove,
  onRemoveSticker,
  onRemoveText,
  drawEnabled,
  editingTextId,
  setEditingTextId,
  onTextChange,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  stickerLayers: StickerLayerState[];
  textLayers: TextLayerState[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onStickerMove: (id: string, nx: number, ny: number) => void;
  onTextMove: (id: string, nx: number, ny: number) => void;
  onRemoveSticker: (id: string) => void;
  onRemoveText: (id: string) => void;
  drawEnabled: boolean;
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
  onTextChange: (id: string, text: string) => void;
}) {
  const dragRef = useRef<DragPayload | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const nx = clamp01(d.startNx + dx / d.rect.width);
      const ny = clamp01(d.startNy + dy / d.rect.height);
      if (d.kind === 'sticker') onStickerMove(d.id, nx, ny);
      else onTextMove(d.id, nx, ny);
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [onStickerMove, onTextMove]);

  const startDrag = useCallback(
    (kind: 'sticker' | 'text', id: string, nx: number, ny: number, e: React.PointerEvent) => {
      if (drawEnabled) return;
      e.stopPropagation();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragRef.current = {
        id,
        kind,
        startX: e.clientX,
        startY: e.clientY,
        startNx: nx,
        startNy: ny,
        rect,
      };
      setSelectedId(id);
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [containerRef, drawEnabled, setSelectedId],
  );

  if (drawEnabled) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[15]">
      {stickerLayers.map((s) => (
        <div
          key={s.id}
          className="pointer-events-auto absolute"
          style={{
            left: `${s.nx * 100}%`,
            top: `${s.ny * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <StickerThumb
            mediaId={s.mediaId}
            nWidth={s.nWidth}
            rotation={s.rotation}
            selected={selectedId === s.id}
            onPointerDown={(e) => startDrag('sticker', s.id, s.nx, s.ny, e)}
          />
          {selectedId === s.id && (
            <button
              type="button"
              className="absolute -right-2 -top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white shadow"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onRemoveSticker(s.id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      {textLayers.map((t) => (
        <div
          key={t.id}
          data-story-text="1"
          className="pointer-events-auto absolute max-w-[92%]"
          style={{
            left: `${t.nx * 100}%`,
            top: `${t.ny * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {editingTextId === t.id ? (
            <textarea
              autoFocus
              value={t.text}
              onChange={(e) => onTextChange(t.id, e.target.value)}
              onBlur={() => setEditingTextId(null)}
              className="min-h-[3rem] w-[min(280px,85vw)] resize-none rounded-lg border border-sky-500/60 bg-black/80 px-2 py-1.5 text-center text-white outline-none"
              style={{ fontSize: `${Math.max(14, t.nFont * 400)}px`, color: t.color }}
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              className={cn(
                'relative rounded-lg px-2 py-1 text-center font-semibold shadow-md',
                selectedId === t.id && 'ring-2 ring-sky-400',
              )}
              style={{
                fontSize: `${Math.max(14, t.nFont * 400)}px`,
                color: t.color,
                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              }}
              onPointerDown={(e) => startDrag('text', t.id, t.nx, t.ny, e)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingTextId(t.id);
              }}
            >
              <span className="whitespace-pre-wrap break-words">{t.text || 'Текст'}</span>
              {selectedId === t.id && (
                <GripVertical className="absolute -left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
              )}
            </button>
          )}
          {selectedId === t.id && editingTextId !== t.id && (
            <button
              type="button"
              className="absolute -right-2 -top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white shadow"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onRemoveText(t.id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
