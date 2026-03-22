'use client';

import { useState, useCallback, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getCroppedImageBlob } from '@/lib/crop-image';
import { getErrorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  imageSrc: string | null;
  /** Свободное соотношение сторон, если не задано */
  aspect?: number;
  title: string;
  onClose: () => void;
  onCropped: (blob: Blob) => Promise<void>;
}

export function ImageCropDialog({ open, imageSrc, aspect, title, onClose, onCropped }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setErr('');
    }
  }, [open, imageSrc]);

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels) return;
    setBusy(true);
    setErr('');
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      await onCropped(blob);
      onClose();
    } catch (e: unknown) {
      setErr(getErrorMessage(e) || 'Не удалось обработать изображение');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        {imageSrc ? (
          <div className="relative h-64 w-full bg-black md:h-80">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              {...(aspect != null ? { aspect } : {})}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
            />
          </div>
        ) : null}
        <div className="space-y-3 border-t border-border p-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground shrink-0">Масштаб</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
          </div>
          {err ? <p className="text-xs text-destructive">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
              Отмена
            </Button>
            <Button type="button" size="sm" disabled={busy || !croppedAreaPixels} onClick={() => void handleSave()}>
              {busy ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
