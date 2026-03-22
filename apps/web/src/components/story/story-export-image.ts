/** Утилиты экспорта кадра истории (фото + обрезка + фильтр + стикеры + текст + слой рисования). */

import type { CropRect } from '@/components/story/story-crop';

export const STORY_EXPORT_WIDTH = 1080;
export const STORY_EXPORT_HEIGHT = 1920;
const STORY_W = STORY_EXPORT_WIDTH;
const STORY_H = STORY_EXPORT_HEIGHT;

export const TEXT_BACKGROUNDS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

export const FILTER_PRESETS = [
  { id: 'none', label: 'Оригинал', filter: 'none' },
  { id: 'bw', label: 'Ч/Б', filter: 'grayscale(1)' },
  { id: 'warm', label: 'Тёплый', filter: 'sepia(0.35) saturate(1.2)' },
  { id: 'cool', label: 'Холодный', filter: 'saturate(0.85) hue-rotate(12deg)' },
  { id: 'fade', label: 'Киношный', filter: 'contrast(1.08) brightness(0.95) saturate(0.9)' },
  { id: 'vivid', label: 'Яркий', filter: 'saturate(1.35) contrast(1.05)' },
  { id: 'soft', label: 'Мягкий', filter: 'brightness(1.06) contrast(0.96) saturate(0.92)' },
] as const;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось загрузить изображение'));
    };
    img.src = url;
  });
}

export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Не удалось загрузить стикер');
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Не удалось прочитать изображение'));
    };
    img.src = objUrl;
  });
}

/** Рисует изображение в прямоугольник с режимом object-cover. */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dw: number,
  dh: number,
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = dw / dh;
  let sx: number;
  let sy: number;
  let sw: number;
  let sh: number;
  if (ir > cr) {
    sh = img.naturalHeight;
    sw = sh * cr;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / cr;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
}

/** Текстовая история → PNG 9:16. */
export function drawTextStoryToBlob(text: string, cssGradient: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = STORY_W;
    canvas.height = STORY_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas not supported'));
      return;
    }
    const colors = cssGradient.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g) || ['#667eea', '#764ba2'];
    const gradient = ctx.createLinearGradient(0, 0, STORY_W, STORY_H);
    gradient.addColorStop(0, colors[0] ?? '#667eea');
    gradient.addColorStop(1, colors[1] ?? '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, STORY_W, STORY_H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxW = STORY_W * 0.85;
    let fontSize = 72;
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    while (ctx.measureText(text.split('\n')[0] ?? text).width > maxW && fontSize > 22) {
      fontSize -= 3;
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    }
    const lines = text.split('\n');
    const lineHeight = fontSize * 1.35;
    const startY = (STORY_H - (lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, STORY_W / 2, startY + i * lineHeight);
    });
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
      0.92,
    );
  });
}

export interface StoryStickerExport {
  url: string;
  /** Центр по горизонтали, 0..1 от ширины кадра */
  nx: number;
  /** Центр по вертикали, 0..1 от высоты кадра */
  ny: number;
  /** Ширина стикера как доля ширины кадра (0..1) */
  nWidth: number;
  rotationDeg: number;
}

export interface StoryTextExport {
  text: string;
  nx: number;
  ny: number;
  /** Размер шрифта в пикселях экспорта (высота кадра 1920) */
  fontPx: number;
  color: string;
}

/**
 * Фото: обрезка 9:16 + CSS-фильтр + стикеры + текст + canvas рисования.
 */
export async function exportPhotoStoryBlob(
  imageFile: File,
  options: {
    cssFilter: string;
    overlayCanvas: HTMLCanvasElement | null;
    overlayHasPaint: boolean;
    crop?: CropRect | null;
    stickers?: StoryStickerExport[];
    texts?: StoryTextExport[];
  },
): Promise<Blob> {
  const img = await loadImageFromFile(imageFile);
  const canvas = document.createElement('canvas');
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const crop = options.crop;
  if (crop && crop.cw > 0 && crop.ch > 0) {
    ctx.filter = options.cssFilter || 'none';
    ctx.drawImage(
      img,
      crop.cx,
      crop.cy,
      crop.cw,
      crop.ch,
      0,
      0,
      STORY_W,
      STORY_H,
    );
    ctx.filter = 'none';
  } else {
    ctx.filter = options.cssFilter || 'none';
    drawImageCover(ctx, img, STORY_W, STORY_H);
    ctx.filter = 'none';
  }

  const stickers = options.stickers ?? [];
  for (const s of stickers) {
    try {
      const simg = await loadImageFromUrl(s.url);
      const w = Math.max(16, s.nWidth * STORY_W);
      const h = (simg.naturalHeight / simg.naturalWidth) * w;
      const cx = s.nx * STORY_W;
      const cy = s.ny * STORY_H;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((s.rotationDeg * Math.PI) / 180);
      ctx.drawImage(simg, -w / 2, -h / 2, w, h);
      ctx.restore();
    } catch {
      /* пропускаем битый стикер */
    }
  }

  const texts = options.texts ?? [];
  for (const t of texts) {
    const line = (t.text ?? '').trim();
    if (!line) continue;
    ctx.save();
    ctx.font = `600 ${Math.max(18, t.fontPx)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = t.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    const lines = line.split('\n');
    const lh = t.fontPx * 1.25;
    const startY = t.ny * STORY_H - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => {
      ctx.fillText(ln, t.nx * STORY_W, startY + i * lh);
    });
    ctx.restore();
  }

  if (options.overlayCanvas && options.overlayHasPaint) {
    const ow = options.overlayCanvas.width;
    const oh = options.overlayCanvas.height;
    if (ow > 0 && oh > 0) {
      ctx.drawImage(options.overlayCanvas, 0, 0, ow, oh, 0, 0, STORY_W, STORY_H);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.92,
    );
  });
}
