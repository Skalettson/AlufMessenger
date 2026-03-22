/**
 * Обрезка и масштабирование видео истории до 9:16 (1080×1920) в браузере через ffmpeg.wasm.
 * Ядро подгружается с CDN при первом вызове (~мегабайты).
 */

import type { CropRect } from '@/components/story/story-crop';
import type { FFmpeg } from '@ffmpeg/ffmpeg';

/** Снять обработчик прогресса (если API поддерживает). */
function offProgress(ffmpeg: FFmpeg, handler: (e: { progress: number }) => void) {
  const f = ffmpeg as FFmpeg & { off?: (ev: string, fn: typeof handler) => void };
  f.off?.('progress', handler);
}

const OUT_W = 1080;
const OUT_H = 1920;

/** Версия @ffmpeg/core должна быть совместима с @ffmpeg/ffmpeg 0.12.x */
const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();

    const coreURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm');

    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegSingleton = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

function extFromFile(file: File): string {
  const n = file.name.toLowerCase();
  const m = n.match(/\.([a-z0-9]+)$/);
  if (m) return `.${m[1]}`;
  if (file.type.includes('webm')) return '.webm';
  if (file.type.includes('quicktime')) return '.mov';
  return '.mp4';
}

/** Чётные размеры для H.264, кламп в границах кадра. */
function safeCrop(crop: CropRect, iw: number, ih: number): { cx: number; cy: number; cw: number; ch: number } {
  let cx = Math.floor(crop.cx) & ~1;
  let cy = Math.floor(crop.cy) & ~1;
  let cw = Math.floor(crop.cw) & ~1;
  let ch = Math.floor(crop.ch) & ~1;
  cx = Math.max(0, Math.min(cx, iw - 2));
  cy = Math.max(0, Math.min(cy, ih - 2));
  cw = Math.max(2, Math.min(cw, iw - cx));
  ch = Math.max(2, Math.min(ch, ih - cy));
  if (cw % 2) cw -= 1;
  if (ch % 2) ch -= 1;
  return { cx, cy, cw, ch };
}

/**
 * Обрезает область 9:16 и масштабирует до 1080×1920, H.264 + AAC.
 * @param onProgress 0..1 на этапе кодирования (после загрузки ffmpeg)
 */
export async function processStoryVideoFile(
  file: File,
  crop: CropRect,
  iw: number,
  ih: number,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  const { cx, cy, cw, ch } = safeCrop(crop, iw, ih);
  const vf = `crop=${cw}:${ch}:${cx}:${cy},scale=${OUT_W}:${OUT_H}`;

  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');

  const inName = `in${extFromFile(file)}`;
  const outName = 'story-out.mp4';

  try {
    await ffmpeg.deleteFile(inName);
  } catch {
    /* ignore */
  }
  try {
    await ffmpeg.deleteFile(outName);
  } catch {
    /* ignore */
  }

  await ffmpeg.writeFile(inName, await fetchFile(file));

  const onProg = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(0.99, Math.max(0, progress)));
  };
  ffmpeg.on('progress', onProg);

  const baseArgs = [
    '-y',
    '-i',
    inName,
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '23',
    '-movflags',
    '+faststart',
    '-pix_fmt',
    'yuv420p',
  ];

  try {
    try {
      await ffmpeg.exec([
        ...baseArgs,
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        outName,
      ]);
    } catch {
      await ffmpeg.exec([...baseArgs, '-an', outName]);
    }
  } finally {
    offProgress(ffmpeg, onProg);
  }

  const raw = await ffmpeg.readFile(outName);
  const data = new Uint8Array(await new Blob([raw as BlobPart]).arrayBuffer());
  const blob = new Blob([data], { type: 'video/mp4' });

  try {
    await ffmpeg.deleteFile(inName);
  } catch {
    /* ignore */
  }
  try {
    await ffmpeg.deleteFile(outName);
  } catch {
    /* ignore */
  }

  onProgress?.(1);
  return new File([blob], 'story.mp4', { type: 'video/mp4' });
}
