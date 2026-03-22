'use client';
import { useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { apiChatToPreview, type ApiChat } from '@/lib/chat-mappers';
import { useChatStore } from '@/stores/chat-store';
import { usePresenceStore } from '@/stores/presence-store';

function parseChatList(res: unknown): ApiChat[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const o = res as Record<string, unknown>;
    if (Array.isArray(o.chats)) return o.chats as ApiChat[];
    if (Array.isArray(o.data)) return o.data as ApiChat[];
  }
  return [];
}

export function useChats() {
  const { chats, isLoading, setChats, setLoading } = useChatStore();

  const fetchChats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<unknown>('/chats?limit=50');
      const list = parseChatList(res);
      const mapped: ReturnType<typeof apiChatToPreview>[] = [];
      for (const item of list) {
        try {
          mapped.push(apiChatToPreview(item as ApiChat));
        } catch {
          // пропускаем невалидный элемент
        }
      }
      let savedSeen = false;
      const deduped = mapped.filter((c) => {
        if (c.type === 'saved') {
          if (savedSeen) return false;
          savedSeen = true;
        }
        return true;
      });
      setChats(deduped);

      const otherUserIds = [...new Set(deduped.map((c) => c.otherUserId).filter(Boolean))] as string[];
      if (otherUserIds.length > 0) {
        try {
          const presenceRes = await api.get<Record<string, { isOnline?: boolean; lastSeenAt?: string }>>(
            `/users/presence?ids=${otherUserIds.map(encodeURIComponent).join(',')}`,
          );
          if (presenceRes && typeof presenceRes === 'object') {
            const record: Record<string, { isOnline: boolean; lastSeenAt?: string | null }> = {};
            for (const [id, v] of Object.entries(presenceRes)) {
              if (v && typeof v === 'object') record[id] = { isOnline: v.isOnline ?? false, lastSeenAt: v.lastSeenAt ?? null };
            }
            usePresenceStore.getState().setBulk(record);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, [setChats, setLoading]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  return { chats, isLoading, refetch: fetchChats };
}
