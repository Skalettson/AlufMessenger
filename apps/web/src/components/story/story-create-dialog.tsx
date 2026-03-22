'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Image as ImageIcon,
  Type,
  ChevronLeft,
  ChevronDown,
  Paintbrush,
  Eraser,
  Users,
  UserMinus,
  Globe,
  Clock,
  Crown,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Sticker,
  Plus,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUiStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { api, getAccessToken, getErrorMessage } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import { cn } from '@/lib/utils';
import {
  TEXT_BACKGROUNDS,
  FILTER_PRESETS,
  drawTextStoryToBlob,
  exportPhotoStoryBlob,
  STORY_EXPORT_HEIGHT,
} from '@/components/story/story-export-image';
import type { CropRect } from '@/components/story/story-crop';
import { initCrop, zoomCrop, panCropFromStart } from '@/components/story/story-crop';
import {
  StoryEditorLayers,
  type StickerLayerState,
  type TextLayerState,
} from '@/components/story/story-editor-layers';
import { EmojiStickerPicker } from '@/components/chat/emoji-sticker-picker';

type Privacy = 'everyone' | 'contacts' | 'selected' | 'except';

interface ContactRow {
  contactUserId: string;
  displayName: string;
  avatarUrl: string | null;
}

const TTL_OPTIONS = [6, 12, 24, 48] as const;

/** Быстрый выбор цвета кисти */
const BRUSH_SWATCHES = [
  '#ffffff',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#34d399',
  '#38bdf8',
  '#000000',
] as const;

const PRIVACY_ITEMS: { id: Privacy; label: string; hint: string; icon: typeof Globe }[] = [
  { id: 'everyone', label: 'Все', hint: 'Любой по ссылке или из поиска', icon: Globe },
  { id: 'contacts', label: 'Контакты', hint: 'Только из списка контактов', icon: Users },
  { id: 'selected', label: 'Выбранные', hint: 'Только отмеченные люди', icon: Sparkles },
  { id: 'except', label: 'Кроме…', hint: 'Контакты, кроме выбранных', icon: UserMinus },
];

export function StoryCreateDialog() {
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const isOpen = activeModal === ('story-create' as any);
  const isPremium = useAuthStore((s) => s.user?.isPremium ?? false);

  const [mode, setMode] = useState<'choose' | 'text' | 'media'>('choose');
  const [text, setText] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('contacts');
  const [privacyUserIds, setPrivacyUserIds] = useState<string[]>([]);
  const [ttlHours, setTtlHours] = useState(24);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [publishError, setPublishError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [filterPreset, setFilterPreset] = useState<string>('none');
  const [drawEnabled, setDrawEnabled] = useState(false);
  const [drawColor, setDrawColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(4);
  const [hasPaint, setHasPaint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingActive = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const [mediaNatural, setMediaNatural] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [maxCover, setMaxCover] = useState<CropRect | null>(null);
  const [stickerLayers, setStickerLayers] = useState<StickerLayerState[]>([]);
  const [textLayers, setTextLayers] = useState<TextLayerState[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const cropPanRef = useRef<{
    startX: number;
    startY: number;
    snapshot: CropRect;
    scale: number;
  } | null>(null);
  const [previewBox, setPreviewBox] = useState({ w: 0, h: 0 });

  const filterCss =
    FILTER_PRESETS.find((f) => f.id === filterPreset)?.filter ?? 'none';

  useEffect(() => {
    if (!isOpen) return;
    setMode('choose');
    setText('');
    setBgIndex(0);
    setFile(null);
    setPreview(null);
    setCaption('');
    setPrivacy('contacts');
    setPrivacyUserIds([]);
    setTtlHours(24);
    setPublishError('');
    setUploadProgress(0);
    setFilterPreset('none');
    setDrawEnabled(false);
    setHasPaint(false);
    setBrushSize(4);
    setMediaNatural(null);
    setCrop(null);
    setMaxCover(null);
    setStickerLayers([]);
    setTextLayers([]);
    setSelectedLayerId(null);
    setEditingTextId(null);
    setShowStickerPicker(false);
    cropPanRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setContactsLoading(true);
      try {
        const res = await api.get<{ contacts: Array<{ contactUserId: string; customName: string | null; contactUser: { username?: string; firstName?: string; lastName?: string; avatarUrl?: string | null } }> }>(
          '/users/me/contacts?limit=200&offset=0',
        );
        if (cancelled) return;
        const rows: ContactRow[] = (res.contacts || []).map((c) => {
          const u = c.contactUser;
          const name =
            (c.customName && c.customName.trim()) ||
            [u?.firstName, u?.lastName].filter(Boolean).join(' ') ||
            u?.username ||
            'Контакт';
          return {
            contactUserId: c.contactUserId,
            displayName: name,
            avatarUrl: u?.avatarUrl ?? null,
          };
        });
        setContacts(rows);
      } catch {
        setContacts([]);
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!preview || !file) {
      setMediaNatural(null);
      setCrop(null);
      setMaxCover(null);
      return;
    }
    if (file.type.startsWith('image/')) {
      const img = new window.Image();
      img.onload = () => {
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        if (iw < 2 || ih < 2) return;
        setMediaNatural({ w: iw, h: ih });
        const c = initCrop(iw, ih);
        setCrop(c);
        setMaxCover(c);
      };
      img.src = preview;
      return;
    }
    if (file.type.startsWith('video/')) {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      const onMeta = () => {
        const iw = v.videoWidth;
        const ih = v.videoHeight;
        if (iw < 2 || ih < 2) return;
        setMediaNatural({ w: iw, h: ih });
        const c = initCrop(iw, ih);
        setCrop(c);
        setMaxCover(c);
      };
      v.addEventListener('loadedmetadata', onMeta);
      v.src = preview;
      return () => {
        v.removeEventListener('loadedmetadata', onMeta);
        v.src = '';
        v.load();
      };
    }
    setMediaNatural(null);
    setCrop(null);
    setMaxCover(null);
  }, [preview, file]);

  const resizeDrawCanvas = useCallback(() => {
    const el = containerRef.current;
    const c = drawCanvasRef.current;
    if (!el || !c) return;
    const w = Math.floor(el.clientWidth);
    const h = Math.floor(el.clientHeight);
    if (w < 2 || h < 2) return;
    if (c.width === w && c.height === h) return;
    const prev = document.createElement('canvas');
    prev.width = c.width;
    prev.height = c.height;
    if (c.width > 0 && c.height > 0) {
      prev.getContext('2d')?.drawImage(c, 0, 0);
    }
    c.width = w;
    c.height = h;
    if (prev.width > 0 && prev.height > 0) {
      c.getContext('2d')?.drawImage(prev, 0, 0, w, h);
    }
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || mode !== 'media' || !file) return;
    if (!(file.type.startsWith('image/') || file.type.startsWith('video/'))) return;
    if (file.type.startsWith('image/')) {
      resizeDrawCanvas();
    }
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (file.type.startsWith('image/')) resizeDrawCanvas();
      setPreviewBox({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setPreviewBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [isOpen, mode, file, preview, resizeDrawCanvas]);

  if (!isOpen) return null;

  function handleFile(f: File) {
    setPublishError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMode('media');
    setFilterPreset('none');
    setHasPaint(false);
    setDrawEnabled(false);
    setStickerLayers([]);
    setTextLayers([]);
    setSelectedLayerId(null);
    setEditingTextId(null);
    setShowStickerPicker(false);
    cropPanRef.current = null;
  }

  const addStickerFromMedia = useCallback((mediaId: string) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`;
    setStickerLayers((prev) => [
      ...prev,
      { id, mediaId, nx: 0.5, ny: 0.42, nWidth: 0.32, rotation: 0 },
    ]);
    setSelectedLayerId(id);
    setShowStickerPicker(false);
  }, []);

  const addTextLayer = useCallback(() => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}`;
    setTextLayers((prev) => [
      ...prev,
      { id, text: '', nx: 0.5, ny: 0.55, nFont: 0.048, color: '#ffffff' },
    ]);
    setSelectedLayerId(id);
    setEditingTextId(id);
  }, []);

  const selectedSticker = stickerLayers.find((s) => s.id === selectedLayerId);

  function handleCropPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (drawEnabled || !crop || !mediaNatural || !maxCover) return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-sticker]') || t.closest('[data-story-text]')) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    cropPanRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      snapshot: { ...crop },
      scale: crop.cw / rect.width,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function handleCropPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = cropPanRef.current;
    if (!p || !mediaNatural) return;
    const dcx = -(e.clientX - p.startX) * p.scale;
    const dcy = -(e.clientY - p.startY) * p.scale;
    setCrop(panCropFromStart(p.snapshot, mediaNatural.w, mediaNatural.h, dcx, dcy));
  }

  function handleCropPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    cropPanRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !crop || !mediaNatural || !maxCover) return;
    const onWheel = (ev: WheelEvent) => {
      if (drawEnabled) return;
      ev.preventDefault();
      const dir = ev.deltaY > 0 ? 1.08 : 0.92;
      setCrop((prev) => {
        if (!prev || !maxCover) return prev;
        return zoomCrop(prev, mediaNatural.w, mediaNatural.h, dir, maxCover);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [mediaNatural, maxCover, drawEnabled]);

  function ensureMediaId(media: { id?: string } | null | undefined): string {
    const v = media?.id ?? (media as { file_id?: string })?.file_id;
    return String(v ?? '').trim();
  }

  function togglePrivacyUser(id: string) {
    setPrivacyUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function validatePrivacy(): string | null {
    if (privacy === 'selected' && privacyUserIds.length === 0) {
      return 'Выберите хотя бы одного человека для режима «Выбранные»';
    }
    if (privacy === 'except' && privacyUserIds.length === 0) {
      return 'Укажите контактов-исключений для режима «Кроме…»';
    }
    return null;
  }

  const getPointerPos = (e: React.PointerEvent, canvas: HTMLCanvasElement) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDrawPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawEnabled || !file?.type.startsWith('image/')) return;
    const c = drawCanvasRef.current;
    if (!c) return;
    drawingActive.current = true;
    c.setPointerCapture(e.pointerId);
    lastPoint.current = getPointerPos(e, c);
  };

  const onDrawPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingActive.current || !drawEnabled) return;
    const c = drawCanvasRef.current;
    if (!c || !lastPoint.current) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const p = getPointerPos(e, c);
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
    setHasPaint(true);
  };

  const onDrawPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingActive.current = false;
    lastPoint.current = null;
    try {
      drawCanvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  function clearDrawing() {
    const c = drawCanvasRef.current;
    if (!c) return;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setHasPaint(false);
  }

  async function publishText() {
    if (!text.trim()) return;
    const err = validatePrivacy();
    if (err) {
      setPublishError(err);
      return;
    }
    setPublishing(true);
    setUploadProgress(0);
    setPublishError('');
    try {
      const blob = await drawTextStoryToBlob(text, TEXT_BACKGROUNDS[bgIndex]);
      const f = new File([blob], 'story.png', { type: 'image/png' });
      const media = await uploadFile(f, undefined, (p) => setUploadProgress(p));
      const mediaId = ensureMediaId(media).trim();
      if (!mediaId) throw new Error('Не удалось загрузить медиа');
      await api.post('/stories', {
        mediaId,
        media_id: mediaId,
        caption: text,
        privacy,
        ttlHours,
        allowedUserIds: privacy === 'selected' ? privacyUserIds : undefined,
        excludedUserIds: privacy === 'except' ? privacyUserIds : undefined,
      });
      window.dispatchEvent(new Event('story-updated'));
      handleClose();
    } catch (e) {
      setPublishError(getErrorMessage(e) || 'Не удалось опубликовать');
    } finally {
      setPublishing(false);
    }
  }

  async function publishMedia() {
    if (!file) return;
    const err = validatePrivacy();
    if (err) {
      setPublishError(err);
      return;
    }
    setPublishing(true);
    setUploadProgress(0);
    setPublishError('');
    try {
      let upload = file;
      if (file.type.startsWith('image/')) {
        if (!crop || !mediaNatural) {
          setPublishError('Подождите, пока подготовится изображение');
          setPublishing(false);
          return;
        }
        const token = getAccessToken();
        if (!token) {
          setPublishError('Нет авторизации');
          setPublishing(false);
          return;
        }
        const stickerExports = stickerLayers.map((s) => ({
          url: `/api/media/${encodeURIComponent(s.mediaId)}/stream?token=${encodeURIComponent(token)}`,
          nx: s.nx,
          ny: s.ny,
          nWidth: s.nWidth,
          rotationDeg: s.rotation,
        }));
        const textExports = textLayers
          .filter((t) => t.text.trim())
          .map((t) => ({
            text: t.text,
            nx: t.nx,
            ny: t.ny,
            fontPx: Math.round(Math.max(22, t.nFont * STORY_EXPORT_HEIGHT)),
            color: t.color,
          }));
        const blob = await exportPhotoStoryBlob(file, {
          cssFilter: filterCss,
          overlayCanvas: drawCanvasRef.current,
          overlayHasPaint: hasPaint,
          crop,
          stickers: stickerExports,
          texts: textExports,
        });
        upload = new File([blob], 'story.jpg', { type: 'image/jpeg' });
      } else if (file.type.startsWith('video/')) {
        if (!crop || !mediaNatural) {
          setPublishError('Подождите, пока подготовится видео');
          setPublishing(false);
          return;
        }
        const { processStoryVideoFile } = await import('@/lib/story-ffmpeg-video');
        upload = await processStoryVideoFile(
          file,
          crop,
          mediaNatural.w,
          mediaNatural.h,
          (ratio) => setUploadProgress(Math.min(84, Math.round(ratio * 84))),
        );
        setUploadProgress(85);
      }
      const media = await uploadFile(upload, undefined, (p) => {
        if (file.type.startsWith('video/')) {
          setUploadProgress(85 + Math.round((p / 100) * 15));
        } else {
          setUploadProgress(p);
        }
      });
      const mediaId = ensureMediaId(media).trim();
      if (!mediaId) throw new Error('Не удалось загрузить медиа');
      await api.post('/stories', {
        mediaId,
        media_id: mediaId,
        caption: caption.trim() || undefined,
        privacy,
        ttlHours,
        allowedUserIds: privacy === 'selected' ? privacyUserIds : undefined,
        excludedUserIds: privacy === 'except' ? privacyUserIds : undefined,
      });
      window.dispatchEvent(new Event('story-updated'));
      handleClose();
    } catch (e) {
      setPublishError(getErrorMessage(e) || 'Не удалось опубликовать');
    } finally {
      setPublishing(false);
    }
  }

  function handleClose() {
    setMode('choose');
    setText('');
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCaption('');
    setPrivacy('contacts');
    setPrivacyUserIds([]);
    setTtlHours(24);
    setPublishError('');
    closeModal();
  }

  const stepVisual = mode === 'choose' ? 1 : mode === 'text' ? 2 : 3;
  const isImageMedia = file?.type.startsWith('image/');
  const isVideoMedia = file?.type.startsWith('video/');

  const privacyBlock = (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-zinc-400">Кто может смотреть</Label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRIVACY_ITEMS.map((p) => {
            const Icon = p.icon;
            const on = privacy === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPrivacy(p.id)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border px-2.5 py-2 text-left transition-colors',
                  on
                    ? 'border-sky-500 bg-sky-500/15 text-sky-100'
                    : 'border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-zinc-500',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" />
                <span className="text-[11px] font-semibold leading-tight">{p.label}</span>
                <span className="text-[10px] leading-snug text-zinc-500">{p.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(privacy === 'selected' || privacy === 'except') && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-2">
          <Label className="text-xs text-zinc-400">
            {privacy === 'selected' ? 'Кому показывать' : 'Кого скрыть из контактов'}
          </Label>
          {contactsLoading ? (
            <p className="py-3 text-center text-xs text-zinc-500">Загрузка контактов…</p>
          ) : contacts.length === 0 ? (
            <p className="py-2 text-xs text-zinc-500">Нет контактов — добавьте их в разделе «Контакты».</p>
          ) : (
            <ScrollArea className="mt-2 h-[min(40vh,220px)] pr-2">
              <ul className="space-y-1">
                {contacts.map((c) => {
                  const checked = privacyUserIds.includes(c.contactUserId);
                  return (
                    <li key={c.contactUserId}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-800/80">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePrivacyUser(c.contactUserId)}
                          className="h-4 w-4 rounded border-zinc-600"
                        />
                        <span className="truncate text-sm text-zinc-200">{c.displayName}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </div>
      )}

      <div>
        <Label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Clock className="h-3.5 w-3.5" />
          Видна (часов)
        </Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {TTL_OPTIONS.map((h) => {
            const locked = !isPremium && h !== 24;
            const active = ttlHours === h;
            return (
              <button
                key={h}
                type="button"
                disabled={locked}
                title={locked ? 'Доступно с Premium' : undefined}
                onClick={() => !locked && setTtlHours(h)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-sky-500 bg-sky-500/20 text-sky-100'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400',
                  locked && 'cursor-not-allowed opacity-45',
                )}
              >
                {h} ч
                {locked && <Crown className="h-3 w-3 text-amber-400" />}
              </button>
            );
          })}
        </div>
        {!isPremium && (
          <p className="mt-1.5 text-[10px] text-zinc-500">
            6, 12 и 48 ч — в Premium. Сейчас доступно 24 ч.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-black text-zinc-100"
      >
        {/* Верхняя панель */}
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-1">
            {mode !== 'choose' && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-zinc-300"
                onClick={() => {
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview(null);
                  setFile(null);
                  setMode('choose');
                  setPublishError('');
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="truncate text-base font-semibold tracking-tight">
              {mode === 'choose' ? 'Новая история' : mode === 'text' ? 'Текст' : 'Редактор'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden gap-0.5 sm:flex" aria-hidden>
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={cn(
                    'h-1 w-6 rounded-full transition-colors',
                    s <= stepVisual ? 'bg-sky-500' : 'bg-zinc-700',
                  )}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-zinc-400 hover:text-white"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {publishError ? (
          <div className="mx-3 mt-2 rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-200">
            {publishError}
          </div>
        ) : null}

        {/* Контент */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {mode === 'choose' && (
            <div className="flex flex-1 flex-col justify-center gap-4 p-4">
              <p className="text-center text-sm leading-relaxed text-zinc-400">
                Текст на градиенте или фото и видео
                <br />
                <span className="text-zinc-500">из галереи устройства</span>
              </p>
              <div className="mx-auto grid w-full max-w-lg grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setMode('text')}
                  className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-700 bg-zinc-900/80 p-8 transition-colors hover:border-sky-500/50 hover:bg-zinc-800/80"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg">
                    <Type className="h-8 w-8 text-white" />
                  </div>
                  <span className="text-sm font-semibold">Текст</span>
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-700 bg-zinc-900/80 p-8 transition-colors hover:border-sky-500/50 hover:bg-zinc-800/80"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 shadow-lg">
                    <ImageIcon className="h-8 w-8 text-white" />
                  </div>
                  <span className="text-sm font-semibold">Фото / Видео</span>
                </button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          )}

          {mode === 'text' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div
                className="relative mx-auto flex min-h-0 w-full max-w-md flex-1 items-center justify-center p-4"
                style={{ background: TEXT_BACKGROUNDS[bgIndex] }}
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Напишите историю…"
                  maxLength={200}
                  className="max-h-[min(50vh,360px)] w-full resize-none bg-transparent px-4 text-center text-2xl font-bold text-white placeholder:text-white/45 focus:outline-none"
                  rows={6}
                />
              </div>
              <div className="shrink-0 border-t border-white/10 bg-zinc-950/95 backdrop-blur-md">
                <div className="mx-auto max-w-lg space-y-3 px-4 py-3">
                  <div>
                    <Label className="text-xs text-zinc-400">Фон</Label>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {TEXT_BACKGROUNDS.map((bg, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setBgIndex(i)}
                          className={cn(
                            'h-10 w-10 rounded-full ring-2 ring-offset-2 ring-offset-zinc-950 transition-transform',
                            bgIndex === i ? 'ring-sky-500 scale-110' : 'ring-transparent hover:scale-105',
                          )}
                          style={{ background: bg }}
                        />
                      ))}
                    </div>
                  </div>
                  <details className="rounded-2xl border border-zinc-800/90 bg-zinc-900/90 px-3 py-1">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-sm font-medium text-zinc-200 [&::-webkit-details-marker]:hidden">
                      Кто видит и срок
                      <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 opacity-80" />
                    </summary>
                    <div className="border-t border-zinc-800/80 pb-3 pt-3">{privacyBlock}</div>
                  </details>
                  {publishing && uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                  <Button
                    type="button"
                    onClick={publishText}
                    disabled={!text.trim() || publishing}
                    className="h-12 w-full rounded-2xl bg-sky-500 text-base font-semibold text-white hover:bg-sky-600"
                  >
                    {publishing
                      ? uploadProgress < 100
                        ? `Загрузка ${uploadProgress}%`
                        : 'Публикация…'
                      : 'Опубликовать в историю'}
                  </Button>
                </div>
                <div className="h-[env(safe-area-inset-bottom)] shrink-0" aria-hidden />
              </div>
            </div>
          )}

          {mode === 'media' && (
            <div className="flex min-h-0 flex-1 flex-col bg-black">
              <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pt-1">
                {preview && file && (
                  <div
                    ref={containerRef}
                    onPointerDown={handleCropPointerDown}
                    onPointerMove={handleCropPointerMove}
                    onPointerUp={handleCropPointerUp}
                    onPointerCancel={handleCropPointerUp}
                    className={cn(
                      'relative aspect-[9/16] w-full max-w-[min(100%,420px)] max-h-[min(68dvh,720px)] overflow-hidden rounded-2xl bg-black shadow-[0_25px_80px_-15px_rgba(0,0,0,0.9)] ring-1 ring-white/10',
                      crop && mediaNatural && !drawEnabled && 'cursor-grab active:cursor-grabbing touch-none',
                    )}
                  >
                    {crop && mediaNatural && previewBox.w > 0 ? (
                      isVideoMedia ? (
                        <video
                          src={preview}
                          className="absolute select-none"
                          autoPlay
                          muted
                          playsInline
                          loop
                          style={{
                            left: -crop.cx * (previewBox.w / crop.cw),
                            top: -crop.cy * (previewBox.h / crop.ch),
                            width: mediaNatural.w * (previewBox.w / crop.cw),
                            height: mediaNatural.h * (previewBox.h / crop.ch),
                            maxWidth: 'none',
                          }}
                        />
                      ) : (
                        <>
                          <img
                            src={preview}
                            alt=""
                            draggable={false}
                            className="absolute select-none"
                            style={{
                              left: -crop.cx * (previewBox.w / crop.cw),
                              top: -crop.cy * (previewBox.h / crop.ch),
                              width: mediaNatural.w * (previewBox.w / crop.cw),
                              height: mediaNatural.h * (previewBox.h / crop.ch),
                              filter: filterCss,
                              maxWidth: 'none',
                            }}
                          />
                          <canvas
                            ref={drawCanvasRef}
                            className={cn(
                              'absolute inset-0 h-full w-full touch-none',
                              drawEnabled ? 'pointer-events-auto z-[20]' : 'pointer-events-none',
                            )}
                            onPointerDown={onDrawPointerDown}
                            onPointerMove={onDrawPointerMove}
                            onPointerUp={onDrawPointerUp}
                            onPointerLeave={onDrawPointerUp}
                          />
                          <StoryEditorLayers
                            containerRef={containerRef}
                            stickerLayers={stickerLayers}
                            textLayers={textLayers}
                            selectedId={selectedLayerId}
                            setSelectedId={setSelectedLayerId}
                            onStickerMove={(id, nx, ny) =>
                              setStickerLayers((prev) =>
                                prev.map((s) => (s.id === id ? { ...s, nx, ny } : s)),
                              )
                            }
                            onTextMove={(id, nx, ny) =>
                              setTextLayers((prev) => prev.map((t) => (t.id === id ? { ...t, nx, ny } : t)))
                            }
                            onRemoveSticker={(id) => {
                              setStickerLayers((prev) => prev.filter((s) => s.id !== id));
                              setSelectedLayerId((cur) => (cur === id ? null : cur));
                            }}
                            onRemoveText={(id) => {
                              setTextLayers((prev) => prev.filter((t) => t.id !== id));
                              setSelectedLayerId((cur) => (cur === id ? null : cur));
                              setEditingTextId((cur) => (cur === id ? null : cur));
                            }}
                            drawEnabled={drawEnabled}
                            editingTextId={editingTextId}
                            setEditingTextId={setEditingTextId}
                            onTextChange={(id, text) =>
                              setTextLayers((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)))
                            }
                          />
                        </>
                      )
                    ) : (
                      <>
                        {isVideoMedia ? (
                          <video
                            src={preview}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            controls
                          />
                        ) : (
                          <>
                            <img
                              src={preview}
                              alt=""
                              className="h-full w-full object-cover"
                              style={{ filter: filterCss }}
                              draggable={false}
                            />
                            <canvas
                              ref={drawCanvasRef}
                              className={cn(
                                'absolute inset-0 h-full w-full touch-none',
                                drawEnabled ? 'pointer-events-auto' : 'pointer-events-none',
                              )}
                              onPointerDown={onDrawPointerDown}
                              onPointerMove={onDrawPointerMove}
                              onPointerUp={onDrawPointerUp}
                              onPointerLeave={onDrawPointerUp}
                            />
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {preview && file && (
                <div className="shrink-0 px-4 pb-2 pt-1">
                  <div className="mx-auto max-w-lg">
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Добавить подпись…"
                      maxLength={1024}
                      rows={2}
                      className="min-h-[48px] w-full resize-none rounded-2xl border border-white/10 bg-zinc-900/95 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                </div>
              )}

              {(isImageMedia || isVideoMedia) && (
                <div className="shrink-0 border-t border-white/10 bg-zinc-950/98">
                  <div className="mx-auto max-w-lg">
                    <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      {isImageMedia ? 'Фильтры и инструменты' : 'Кадр 9:16'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-2.5">
                      <span className="w-full text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        Кадр и слои
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!crop || !maxCover || !mediaNatural}
                          onClick={() =>
                            setCrop((c) =>
                              c && maxCover && mediaNatural
                                ? zoomCrop(c, mediaNatural.w, mediaNatural.h, 0.88, maxCover)
                                : c,
                            )
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 disabled:opacity-40"
                          title="Приблизить кадр"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={!crop || !maxCover || !mediaNatural}
                          onClick={() =>
                            setCrop((c) =>
                              c && maxCover && mediaNatural
                                ? zoomCrop(c, mediaNatural.w, mediaNatural.h, 1 / 0.88, maxCover)
                                : c,
                            )
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 disabled:opacity-40"
                          title="Отдалить кадр"
                        >
                          <ZoomOut className="h-4 w-4" />
                        </button>
                      </div>
                      {isImageMedia && (
                        <>
                        <div className="flex w-full flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowStickerPicker((v) => !v)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium',
                            showStickerPicker ? 'border-sky-500 bg-sky-500/15 text-sky-100' : 'border-zinc-700 text-zinc-400',
                          )}
                        >
                          <Sticker className="h-4 w-4" />
                          Стикер
                        </button>
                        <button
                          type="button"
                          onClick={addTextLayer}
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400"
                        >
                          <Plus className="h-4 w-4" />
                          Текст
                        </button>
                      </div>
                      {selectedSticker && (
                        <div className="flex w-full flex-wrap items-center gap-2 border-t border-white/5 pt-2">
                          <span className="text-[11px] text-zinc-500">Размер</span>
                          <input
                            type="range"
                            min={0.14}
                            max={0.52}
                            step={0.01}
                            value={selectedSticker.nWidth}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setStickerLayers((prev) =>
                                prev.map((s) => (s.id === selectedSticker.id ? { ...s, nWidth: v } : s)),
                              );
                            }}
                            className="h-1.5 min-w-[120px] flex-1 accent-sky-500"
                          />
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-zinc-400"
                            title="Повернуть"
                            onClick={() =>
                              setStickerLayers((prev) =>
                                prev.map((s) =>
                                  s.id === selectedSticker.id ? { ...s, rotation: s.rotation + 15 } : s,
                                ),
                              )
                            }
                          >
                            <RotateCw className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                        </>
                      )}
                    </div>
                    {isImageMedia && showStickerPicker && (
                      <div className="border-b border-white/5 px-4 pb-3">
                        <EmojiStickerPicker
                          onSelectEmoji={(emoji) => {
                            const id =
                              typeof crypto !== 'undefined' && crypto.randomUUID
                                ? crypto.randomUUID()
                                : `t-${Date.now()}`;
                            setTextLayers((prev) => [
                              ...prev,
                              { id, text: emoji, nx: 0.5, ny: 0.48, nFont: 0.1, color: '#ffffff' },
                            ]);
                            setSelectedLayerId(id);
                            setShowStickerPicker(false);
                          }}
                          onSelectSticker={(mediaId) => addStickerFromMedia(mediaId)}
                        />
                      </div>
                    )}
                    {isImageMedia && (
                    <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:thin]">
                      {FILTER_PRESETS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFilterPreset(f.id)}
                          className={cn(
                            'shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition-colors',
                            filterPreset === f.id
                              ? 'border-sky-500 bg-sky-500/20 text-sky-100'
                              : 'border-zinc-700 bg-zinc-900/80 text-zinc-400 hover:border-zinc-500',
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    )}
                    {isImageMedia && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-white/5 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDrawEnabled((v) => !v)}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium',
                          drawEnabled
                            ? 'border-amber-400/80 bg-amber-500/15 text-amber-100'
                            : 'border-zinc-700 text-zinc-400',
                        )}
                      >
                        <Paintbrush className="h-4 w-4" />
                        {drawEnabled ? 'Рисую' : 'Кисть'}
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {BRUSH_SWATCHES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            title={c}
                            onClick={() => setDrawColor(c)}
                            className={cn(
                              'h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-zinc-950 transition-transform',
                              drawColor.toLowerCase() === c.toLowerCase() ? 'ring-white scale-110' : 'ring-transparent hover:scale-105',
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <input
                        type="color"
                        value={drawColor}
                        onChange={(e) => setDrawColor(e.target.value)}
                        className="h-8 w-8 shrink-0 cursor-pointer rounded-full border border-zinc-600 bg-zinc-900 p-0"
                        aria-label="Свой цвет"
                      />
                      <button
                        type="button"
                        onClick={clearDrawing}
                        disabled={!hasPaint}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-700 px-3 py-2 text-xs text-zinc-400 disabled:opacity-40"
                      >
                        <Eraser className="h-4 w-4" />
                        Стереть
                      </button>
                      <label className="flex min-w-[120px] flex-1 items-center gap-2 text-[11px] text-zinc-500">
                        <span className="shrink-0">Толщина</span>
                        <input
                          type="range"
                          min={2}
                          max={16}
                          value={brushSize}
                          onChange={(e) => setBrushSize(Number(e.target.value))}
                          className="h-1.5 w-full min-w-0 flex-1 accent-sky-500"
                        />
                      </label>
                    </div>
                    )}
                  </div>
                </div>
              )}

              <details className="shrink-0 border-t border-white/10 bg-black px-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3 text-sm font-medium text-zinc-200 [&::-webkit-details-marker]:hidden">
                  Кто видит и срок
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                </summary>
                <div className="border-t border-zinc-900 pb-3 pt-2">{privacyBlock}</div>
              </details>

              <div className="shrink-0 space-y-2 border-t border-white/10 bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                {publishing && uploadProgress < 100 && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                <Button
                  type="button"
                  onClick={publishMedia}
                  disabled={!file || publishing}
                  className="h-12 w-full rounded-2xl bg-sky-500 text-base font-semibold text-white hover:bg-sky-600"
                >
                  {publishing
                    ? uploadProgress < 100
                      ? isVideoMedia && uploadProgress < 85
                        ? `Кодирование ${uploadProgress}%`
                        : `Загрузка ${uploadProgress}%`
                      : 'Публикация…'
                    : 'Опубликовать в историю'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
