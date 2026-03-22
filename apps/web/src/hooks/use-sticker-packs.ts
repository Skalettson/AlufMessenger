'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface StickerPack {
  id: string;
  name: string;
  isPremium: boolean;
  creatorId: string;
  isPublic: boolean;
  coverMediaId: string | null;
  /** Обложка для UI: сервер подставляет cover или первый стикер */
  previewMediaId?: string | null;
  description: string | null;
  createdAt: string;
  isMine?: boolean;
  addedToMe?: boolean;
}

function normalizeStickerPack(raw: Record<string, unknown>): StickerPack {
  const cover =
    (raw.coverMediaId ?? raw.cover_media_id) as string | null | undefined;
  const preview =
    (raw.previewMediaId ?? raw.preview_media_id) as string | null | undefined;
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    isPremium: Boolean(raw.isPremium ?? raw.is_premium),
    creatorId: String(raw.creatorId ?? raw.creator_id ?? ''),
    isPublic: Boolean(raw.isPublic ?? raw.is_public),
    coverMediaId: cover != null && String(cover).trim() ? String(cover) : null,
    previewMediaId: preview != null && String(preview).trim() ? String(preview) : null,
    description: raw.description != null ? String(raw.description) : null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    isMine: Boolean(raw.isMine ?? raw.is_mine),
    addedToMe: Boolean(raw.addedToMe ?? raw.added_to_me),
  };
}

export interface StickerItem {
  mediaId: string;
  fileName: string;
  mimeType: string;
}

export interface PackWithStickers {
  pack: StickerPack;
  stickers: StickerItem[];
}

export function useMyStickerPacks() {
  return useQuery({
    queryKey: ['sticker-packs', 'my'],
    queryFn: async () => {
      const res = await api.get<{ packs: Record<string, unknown>[] }>('/sticker-packs/my');
      return (res.packs ?? []).map((p) => normalizeStickerPack(p));
    },
  });
}

export function usePublicStickerPacks(search?: string, limit = 50, offset = 0) {
  const params = new URLSearchParams();
  if (search?.trim()) params.set('search', search.trim());
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return useQuery({
    queryKey: ['sticker-packs', 'public', search, limit, offset],
    queryFn: async () => {
      const res = await api.get<{ packs: Record<string, unknown>[] }>(`/sticker-packs/public?${params}`);
      return (res.packs ?? []).map((p) => normalizeStickerPack(p));
    },
  });
}

export function usePackWithStickers(packId: string | null) {
  return useQuery({
    queryKey: ['sticker-packs', packId],
    queryFn: async () => {
      if (!packId) return null;
      const res = await api.get<{ pack?: Record<string, unknown>; stickers?: StickerItem[] }>(`/sticker-packs/${packId}`);
      if (!res?.pack) return null;
      return {
        pack: normalizeStickerPack(res.pack),
        stickers: res.stickers ?? [],
      } satisfies PackWithStickers;
    },
    enabled: !!packId,
  });
}

/** Пак стикера по mediaId стикера (для клика по стикеру в сообщении). */
export function usePackByStickerMediaId(mediaId: string | null) {
  return useQuery({
    queryKey: ['sticker-packs', 'by-sticker', mediaId],
    queryFn: async () => {
      if (!mediaId) return null;
      const res = await api.get<StickerPack>(`/sticker-packs/by-sticker/${encodeURIComponent(mediaId)}`);
      return res;
    },
    enabled: !!mediaId,
  });
}

export function useCreateStickerPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; isPublic?: boolean; description?: string }) => {
      return api.post<StickerPack>('/sticker-packs', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sticker-packs'] });
    },
  });
}

export function useAddStickerToPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ packId, mediaId }: { packId: string; mediaId: string }) => {
      return api.post(`/sticker-packs/${packId}/stickers`, { mediaId });
    },
    onSuccess: (_, { packId }) => {
      qc.invalidateQueries({ queryKey: ['sticker-packs', packId] });
      qc.invalidateQueries({ queryKey: ['sticker-packs', 'my'] });
    },
  });
}

export function useAddPackToMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (packId: string) => {
      return api.post(`/sticker-packs/${packId}/add-to-me`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sticker-packs'] });
    },
    onError: (err: unknown) => {
      console.error('[sticker-packs] add-to-me', err);
    },
  });
}

export function useRemovePackFromMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (packId: string) => {
      return api.delete(`/sticker-packs/${packId}/add-to-me`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sticker-packs'] });
    },
  });
}

export function useDeleteStickerPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (packId: string) => {
      return api.delete(`/sticker-packs/${packId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sticker-packs'] });
    },
  });
}

export function useRemoveStickerFromPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ packId, mediaId }: { packId: string; mediaId: string }) => {
      return api.delete(`/sticker-packs/${packId}/stickers/${mediaId}`);
    },
    onSuccess: (_, { packId }) => {
      qc.invalidateQueries({ queryKey: ['sticker-packs', packId] });
      qc.invalidateQueries({ queryKey: ['sticker-packs', 'my'] });
    },
  });
}
