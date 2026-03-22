'use client';

import { cn } from '@/lib/utils';

interface Props {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  className?: string;
  showTimer?: boolean;
  durationSec?: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CircularProgress({
  progress,
  size = 120,
  strokeWidth = 4,
  children,
  className,
  showTimer = false,
  durationSec = 0,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div
      className={cn('relative shrink-0 flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="pointer-events-none absolute left-0 top-0 -rotate-90"
        aria-hidden
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted-foreground/20"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-primary transition-all duration-100 ease-linear"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: strokeDashoffset,
          }}
        />
      </svg>
      <div className="relative z-[1] flex items-center justify-center">
        {children}
      </div>
      {showTimer && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium tabular-nums text-foreground">
          {formatTime(durationSec)}
        </div>
      )}
    </div>
  );
}
