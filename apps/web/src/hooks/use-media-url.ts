'use client';

import { useState, useEffect } from 'react';
import { getAccessToken, loadTokens } from '@/lib/api';

/**
 * Same-origin URL на `/api/media/:id/stream` с токеном в query (для `<audio>` / `<img>` без blob:).
 * Устраняет CSP/Firefox «нет права загружать blob:» при переключении страниц.
 */
export function useMediaUrl(mediaId: string | null | undefined): string | null {
  const result = useMediaUrlWithType(mediaId);
  return result.url;
}

export function useMediaUrlWithType(mediaId: string | null | undefined): { url: string | null; mimeType: string | null } {
  const [state, setState] = useState<{ url: string | null; mimeType: string | null }>({ url: null, mimeType: null });

  useEffect(() => {
    if (!mediaId?.trim()) {
      setState({ url: null, mimeType: null });
      return;
    }
    loadTokens();
    const token = getAccessToken();
    if (!token) {
      setState({ url: null, mimeType: null });
      return;
    }
    const mid = mediaId.trim();
    const streamUrl = `/api/media/${encodeURIComponent(mid)}/stream?token=${encodeURIComponent(token)}`;
    setState({ url: streamUrl, mimeType: null });
  }, [mediaId]);

  return state;
}
