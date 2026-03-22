'use client';

import { Music } from 'lucide-react';
import { useMediaUrl } from '@/hooks/use-media-url';
import { cn } from '@/lib/utils';

type Props = {
  mediaId?: string | null;
  className?: string;
  alt?: string;
  iconClassName?: string;
};

/** Обложка через same-origin stream + blob (как медиа в чатах), не presigned MinIO. */
export function MediaCoverThumb({ mediaId, className, alt = '', iconClassName }: Props) {
  const url = useMediaUrl(mediaId);

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden bg-muted text-muted-foreground',
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Music className={cn('h-5 w-5 text-primary', iconClassName)} aria-hidden />
      )}
    </div>
  );
}
