'use client';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, getProxiedImageUrl } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  src: string | null | undefined;
  name: string;
  isOnline?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Сброс кэша изображения (например updatedAt профиля). */
  cacheBust?: string | number | null;
}

const sizeClasses = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-lg',
};

/** Убираем из className классы размеров, чтобы не смешивать с sizeClasses и не получить овал. */
function stripSizeClasses(className?: string): string {
  if (!className) return '';
  return className
    .split(/\s+/)
    .filter((c) => !/^(size|h|w)-\d+$/.test(c))
    .join(' ');
}

/** Берём один размер из className (size-X, h-X или w-X) для квадрата. */
function getSizeFromClassName(className?: string): string | null {
  if (!className) return null;
  const match = className.match(/\bsize-(\d+)\b/) ?? className.match(/\b[hw]-(\d+)\b/);
  return match ? `size-${match[1]}` : null;
}

const dotSize = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3.5 w-3.5',
  xl: 'h-4 w-4',
};

export function UserAvatar({ src, name, isOnline, size = 'md', className, cacheBust }: UserAvatarProps) {
  const sizeClass = sizeClasses[size];
  const customSize = getSizeFromClassName(className);
  const restClass = stripSizeClasses(className);
  const img = getProxiedImageUrl(src, cacheBust);
  return (
    <div
      className={cn(
        'relative inline-flex flex-shrink-0 items-center justify-center rounded-full aspect-square',
        customSize ?? sizeClass,
        restClass,
      )}
    >
      <Avatar className="size-full min-w-0 min-h-0 flex items-center justify-center overflow-hidden rounded-full">
        {img && <AvatarImage src={img} alt={name} className="object-cover" />}
        <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold size-full">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      {isOnline !== undefined && (
        <span
          className={cn(
            'absolute right-0.5 bottom-0.5 rounded-full border-2 border-background shadow-sm',
            isOnline ? 'bg-success animate-pulse-ring' : 'bg-muted-foreground/70',
            dotSize[size],
          )}
          title={isOnline ? 'В сети' : 'Не в сети'}
          aria-hidden
        />
      )}
    </div>
  );
}
