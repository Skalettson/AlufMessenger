'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CustomEmojiItem {
  id: string;
  creatorId: string;
  mediaId: string;
  shortcode: string;
  createdAt: string;
  url?: string;
}

export function useMyCustomEmoji() {
  return useQuery({
    queryKey: ['custom-emoji', 'my'],
    queryFn: async () => {
      const res = await api.get<{ emoji: CustomEmojiItem[] }>('/custom-emoji/my');
      return res.emoji ?? [];
    },
  });
}

export function usePublicCustomEmoji(search?: string, limit = 50, offset = 0) {
  const params = new URLSearchParams();
  if (search?.trim()) params.set('search', search.trim());
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return useQuery({
    queryKey: ['custom-emoji', 'public', search, limit, offset],
    queryFn: async () => {
      const res = await api.get<{ emoji: CustomEmojiItem[] }>(`/custom-emoji/public?${params}`);
      return res.emoji ?? [];
    },
  });
}

export function useCustomEmojiByShortcode(shortcode: string | null) {
  return useQuery({
    queryKey: ['custom-emoji', 'shortcode', shortcode],
    queryFn: async () => {
      if (!shortcode?.trim()) return null;
      const code = encodeURIComponent(shortcode.trim());
      const res = await api.get<CustomEmojiItem | null>(`/custom-emoji/by-shortcode/${code}`);
      return res;
    },
    enabled: !!shortcode?.trim(),
  });
}

export function useCreateCustomEmoji() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { mediaId: string; shortcode: string }) => {
      return api.post<CustomEmojiItem>('/custom-emoji', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-emoji'] });
    },
  });
}

export function useAddEmojiToMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emojiId: string) => {
      return api.post(`/custom-emoji/${emojiId}/add-to-me`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-emoji'] });
    },
  });
}

export function useRemoveEmojiFromMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emojiId: string) => {
      return api.delete(`/custom-emoji/${emojiId}/add-to-me`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-emoji'] });
    },
  });
}

export function useDeleteCustomEmoji() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emojiId: string) => {
      return api.delete(`/custom-emoji/${emojiId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-emoji'] });
    },
  });
}
