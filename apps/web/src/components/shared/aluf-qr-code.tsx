'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  url: string;
  size?: number;
  className?: string;
}

const GRADIENT_START = '#0088CC';
const GRADIENT_END = '#48cae4';
const DOT_COLOR = '#ffffff';
const LOGO_FRACTION = 0.22;
const ERROR_CORRECTION = 'H';

export function AlufQrCode({ url, size = 256, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    async function render() {
      const modules = await getQrModules(url);
      if (!modules) return;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      drawGradientBackground(ctx, size);
      drawRoundedDots(ctx, modules, size);
      await drawCenterLogo(ctx, size);

      setDataUrl(canvas.toDataURL('image/png'));
    }

    render();
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
      >
        <div className="w-full h-full rounded-2xl shimmer" />
      </div>
    );
  }

  return (
    <img
      ref={canvasRef as unknown as React.Ref<HTMLImageElement>}
      src={dataUrl}
      alt="QR-код Aluf"
      width={size}
      height={size}
      className={`rounded-2xl ${className ?? ''}`}
    />
  );
}

async function getQrModules(data: string): Promise<boolean[][] | null> {
  try {
    const qr = QRCode.create(data, { errorCorrectionLevel: ERROR_CORRECTION });
    const { size, data: bits } = qr.modules;
    const grid: boolean[][] = [];
    for (let row = 0; row < size; row++) {
      const line: boolean[] = [];
      for (let col = 0; col < size; col++) {
        line.push(bits[row * size + col] === 1);
      }
      grid.push(line);
    }
    return grid;
  } catch {
    return null;
  }
}

function drawGradientBackground(ctx: CanvasRenderingContext2D, size: number) {
  const r = size * 0.08;
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, GRADIENT_START);
  gradient.addColorStop(1, GRADIENT_END);
  ctx.fillStyle = gradient;
  roundedRect(ctx, 0, 0, size, size, r);
  ctx.fill();
}

function drawRoundedDots(
  ctx: CanvasRenderingContext2D,
  modules: boolean[][],
  canvasSize: number,
) {
  const count = modules.length;
  const padding = canvasSize * 0.1;
  const available = canvasSize - padding * 2;
  const cellSize = available / count;
  const dotRadius = cellSize * 0.38;

  const logoCenter = canvasSize / 2;
  const logoClearRadius = canvasSize * LOGO_FRACTION * 0.6;

  ctx.fillStyle = DOT_COLOR;

  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!modules[row][col]) continue;

      const cx = padding + col * cellSize + cellSize / 2;
      const cy = padding + row * cellSize + cellSize / 2;

      const dx = cx - logoCenter;
      const dy = cy - logoCenter;
      if (Math.sqrt(dx * dx + dy * dy) < logoClearRadius) continue;

      if (isFinderDot(row, col, count)) {
        drawFinderModule(ctx, row, col, count, padding, cellSize);
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function isFinderDot(row: number, col: number, count: number): boolean {
  if (row < 7 && col < 7) return true;
  if (row < 7 && col >= count - 7) return true;
  if (row >= count - 7 && col < 7) return true;
  return false;
}

function drawFinderModule(
  ctx: CanvasRenderingContext2D,
  row: number,
  col: number,
  count: number,
  padding: number,
  cellSize: number,
) {
  const regions = [
    { startRow: 0, startCol: 0 },
    { startRow: 0, startCol: count - 7 },
    { startRow: count - 7, startCol: 0 },
  ];

  for (const { startRow, startCol } of regions) {
    if (
      row >= startRow && row < startRow + 7 &&
      col >= startCol && col < startCol + 7
    ) {
      const localRow = row - startRow;
      const localCol = col - startCol;

      if (localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6) {
        const cx = padding + col * cellSize + cellSize / 2;
        const cy = padding + row * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4) {
        const cx = padding + col * cellSize + cellSize / 2;
        const cy = padding + row * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
  }
}

async function drawCenterLogo(ctx: CanvasRenderingContext2D, size: number) {
  const logoSize = size * LOGO_FRACTION;
  const x = (size - logoSize) / 2;
  const y = (size - logoSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, logoSize / 2 + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  return new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x, y, logoSize, logoSize);
      ctx.restore();
      resolve();
    };
    img.onerror = () => {
      ctx.save();
      ctx.fillStyle = GRADIENT_START;
      ctx.font = `bold ${logoSize * 0.45}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', size / 2, size / 2);
      ctx.restore();
      resolve();
    };
    img.src = '/icon-96.png';
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
