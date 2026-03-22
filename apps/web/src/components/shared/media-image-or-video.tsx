'use client';

import { cn } from '@/lib/utils';

/** Рендерит изображение или видео (WebM) в зависимости от MIME-типа. */
export function MediaImageOrVideo({
  url,
  mimeType,
  alt = '',
  className,
  style,
  ...rest
}: {
  url: string;
  mimeType?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}) {
  const isVideo = mimeType?.toLowerCase().startsWith('video/');
  if (isVideo) {
    return (
      <video
        src={url}
        className={cn('object-contain', className)}
        style={style}
        autoPlay
        loop
        muted
        playsInline
        {...rest}
      />
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className={cn('object-contain', className)}
      style={style}
      loading="lazy"
      {...rest}
    />
  );
}
