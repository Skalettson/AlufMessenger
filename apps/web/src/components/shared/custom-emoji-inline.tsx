'use client';

import { useCustomEmojiByShortcode } from '@/hooks/use-custom-emoji';
import { useMediaUrlWithType } from '@/hooks/use-media-url';
import { MediaImageOrVideo } from '@/components/shared/media-image-or-video';
import { cn } from '@/lib/utils';

/** Renders a single custom emoji by shortcode (e.g. :my_emoji:). Falls back to plain text if not found or loading. */
export function CustomEmojiInline({
  shortcode,
  className,
  size = 20,
}: {
  shortcode: string;
  className?: string;
  size?: number;
}) {
  const { data: emoji, isLoading } = useCustomEmojiByShortcode(shortcode);
  const { url, mimeType } = useMediaUrlWithType(emoji?.mediaId ?? null);

  if (isLoading || !emoji) {
    return <span className={cn('text-muted-foreground', className)}>{shortcode}</span>;
  }
  if (!url) {
    return <span className={cn('text-muted-foreground', className)}>{shortcode}</span>;
  }
  return (
    <MediaImageOrVideo
      url={url}
      mimeType={mimeType}
      alt={shortcode}
      className={cn('inline-block align-middle', className)}
      style={{ width: size, height: size }}
    />
  );
}
