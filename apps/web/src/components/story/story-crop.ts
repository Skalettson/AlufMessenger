/** Обрезка 9:16 для историй: инициализация, панорамирование, зум. */

export const STORY_ASPECT = 9 / 16;

export interface CropRect {
  cx: number;
  cy: number;
  cw: number;
  ch: number;
}

export function initCrop(iw: number, ih: number): CropRect {
  const ar = STORY_ASPECT;
  const ir = iw / ih;
  let cw: number;
  let ch: number;
  let cx: number;
  let cy: number;
  if (ir > ar) {
    ch = ih;
    cw = ih * ar;
    cx = (iw - cw) / 2;
    cy = 0;
  } else {
    cw = iw;
    ch = iw / ar;
    cx = 0;
    cy = (ih - ch) / 2;
  }
  return { cx, cy, cw, ch };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Зум к центру кадра: factor &lt; 1 — приблизить (меньше вырезка), factor &gt; 1 — отдалить (не больше maxCover). */
export function zoomCrop(crop: CropRect, iw: number, ih: number, factor: number, maxCover: CropRect): CropRect {
  if (Math.abs(factor - 1) < 1e-6) return crop;
  const newCw = crop.cw * factor;
  const newCh = crop.ch * factor;
  const minSide = Math.min(iw, ih);
  const minCrop = minSide * 0.08;
  if (newCw < minCrop || newCh < minCrop) return crop;
  if (newCw > maxCover.cw + 0.5 || newCh > maxCover.ch + 0.5) return maxCover;
  const cx = clamp(crop.cx + (crop.cw - newCw) / 2, 0, iw - newCw);
  const cy = clamp(crop.cy + (crop.ch - newCh) / 2, 0, ih - newCh);
  return { cx, cy, cw: newCw, ch: newCh };
}

/** Сдвиг вырезки относительно текущего crop (пиксели исходного изображения). */
export function panCrop(crop: CropRect, iw: number, ih: number, dcx: number, dcy: number): CropRect {
  const cx = clamp(crop.cx + dcx, 0, iw - crop.cw);
  const cy = clamp(crop.cy + dcy, 0, ih - crop.ch);
  return { ...crop, cx, cy };
}

/** Установить позицию вырезки из снимка + смещение от точки начала жеста. */
export function panCropFromStart(
  snapshot: CropRect,
  iw: number,
  ih: number,
  dcx: number,
  dcy: number,
): CropRect {
  const cx = clamp(snapshot.cx + dcx, 0, iw - snapshot.cw);
  const cy = clamp(snapshot.cy + dcy, 0, ih - snapshot.ch);
  return { ...snapshot, cx, cy };
}
