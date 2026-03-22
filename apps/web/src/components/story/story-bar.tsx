'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { UserAvatar } from '@/components/shared/user-avatar';
import { api } from '@/lib/api';
import { cn, getProxiedImageUrl } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import type { Story } from '@/types';

interface StoryGroup {
  user: { id: string; displayName: string; avatarUrl: string | null };
  stories: Story[];
  hasUnviewed: boolean;
}

interface Props {
  onView: (group: StoryGroup) => void;
  onCreate: () => void;
}

function parseStoryTimestamp(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const sec = Number((value as { seconds?: number }).seconds) || 0;
    const ns = Number((value as { nanos?: number }).nanos) || 0;
    const d = new Date(sec * 1000 + ns / 1_000_000);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  return '';
}

function normalizeStory(raw: Record<string, unknown>): Story {
  const id = String(raw.id ?? raw.story_id ?? '');
  const userId = String(raw.user_id ?? raw.userId ?? '');
  const mediaId = String(raw.media_id ?? raw.mediaId ?? '');
  const caption = raw.caption != null ? String(raw.caption) : null;
  const viewCount = Number(raw.view_count ?? raw.viewCount ?? 0);
  const viewed = Boolean(raw.viewed);
  const createdAt = parseStoryTimestamp(raw.created_at ?? raw.createdAt);
  const expiresAt = parseStoryTimestamp(raw.expires_at ?? raw.expiresAt);
  return {
    id,
    userId,
    mediaId,
    mediaUrl: (raw.media_url ?? raw.mediaUrl) ? String(raw.media_url ?? raw.mediaUrl) : null,
    caption,
    viewCount,
    expiresAt,
    createdAt,
    viewed,
  };
}

export function StoryBar({ onView, onCreate }: Props) {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const currentUser = useAuthStore((s) => s.user);
  const myAvatar = getProxiedImageUrl(currentUser?.avatarUrl ?? null);

  function loadStories() {
    api
      .get<{ story_groups?: Record<string, unknown>[] }>('/stories')
      .then((res) => {
        const list = res?.story_groups ?? [];
        const next: StoryGroup[] = list.map((g: Record<string, unknown>) => {
          const userId = String(g.user_id ?? g.userId ?? '');
          const displayName = String(g.display_name ?? g.displayName ?? '') || 'Мои истории';
          const avatarUrl = (g.avatar_url ?? g.avatarUrl) != null ? String(g.avatar_url ?? g.avatarUrl) : null;
          const storiesRaw = (g.stories ?? []) as Record<string, unknown>[];
          const stories = storiesRaw.map(normalizeStory);
          const hasUnviewed = Boolean(g.has_unseen ?? g.hasUnseen);
          return {
            user: { id: userId, displayName, avatarUrl },
            stories,
            hasUnviewed,
          };
        });
        setGroups(next);
      })
      .catch(() => {
        setGroups([]);
      });
  }

  useEffect(() => {
    loadStories();
  }, []);

  useEffect(() => {
    const onStoryUpdate = () => loadStories();
    window.addEventListener('focus', onStoryUpdate);
    window.addEventListener('story-updated', onStoryUpdate);
    window.addEventListener('profile-updated', onStoryUpdate);
    return () => {
      window.removeEventListener('focus', onStoryUpdate);
      window.removeEventListener('story-updated', onStoryUpdate);
      window.removeEventListener('profile-updated', onStoryUpdate);
    };
  }, []);

  const myGroup = useMemo(
    () => (currentUser?.id ? groups.find((g) => g.user.id === currentUser.id) : undefined),
    [groups, currentUser?.id],
  );

  const otherGroups = useMemo(
    () => (currentUser?.id ? groups.filter((g) => g.user.id !== currentUser.id) : groups),
    [groups, currentUser?.id],
  );

  const hasMyStories = Boolean(myGroup && myGroup.stories.length > 0);

  function handleMyRingClick() {
    if (hasMyStories && myGroup) {
      onView(myGroup);
    } else {
      onCreate();
    }
  }

  return (
    <div className="flex gap-3 px-3 py-2 overflow-x-auto border-b border-border scrollbar-none supports-[padding:max(0px)]:px-[max(0.75rem,env(safe-area-inset-left))]">
      {/* Кольцо «Моя»: свои истории / создание; «+» — только новая история */}
      <div className="touch-interactive flex flex-col items-center gap-1 flex-shrink-0">
        <div className="relative">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleMyRingClick}
            className="relative flex h-14 w-14 items-center justify-center rounded-full p-[2px] outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={hasMyStories ? 'Мои истории' : 'Добавить историю'}
          >
            <div
              className={cn(
                'size-14 flex-shrink-0 overflow-hidden rounded-full p-[2px]',
                hasMyStories
                  ? 'bg-gradient-to-r from-primary via-blue-400 to-primary'
                  : 'border-2 border-dashed border-primary/35 bg-gradient-to-br from-primary/15 to-primary/5',
              )}
            >
              <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-background p-[2px]">
                {myAvatar ? (
                  <UserAvatar src={myAvatar} name={currentUser?.displayName ?? 'Вы'} size="lg" className="size-14" />
                ) : (
                  <div className="flex size-full items-center justify-center text-primary">
                    <Plus className="h-6 w-6" />
                  </div>
                )}
              </div>
            </div>
          </motion.button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreate();
            }}
            className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background transition-transform hover:scale-105 active:scale-95"
            aria-label="Новая история"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <span className="max-w-14 truncate text-[10px] font-medium text-muted-foreground">Моя</span>
      </div>

      {otherGroups.map((g, i) => {
        const avatarForRing = getProxiedImageUrl(g.user.avatarUrl) ?? g.user.avatarUrl;
        return (
          <motion.button
            type="button"
            key={g.user.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onView(g)}
            className="touch-interactive flex flex-col items-center gap-1 flex-shrink-0"
          >
            <div
              className={cn(
                'size-14 flex-shrink-0 overflow-hidden rounded-full p-[2px]',
                g.hasUnviewed
                  ? 'bg-gradient-to-r from-primary via-blue-400 to-primary'
                  : 'bg-border',
              )}
            >
              <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-background p-[2px]">
                <UserAvatar src={avatarForRing} name={g.user.displayName} size="lg" className="size-14" />
              </div>
            </div>
            <span className="max-w-14 truncate text-[10px] text-muted-foreground">
              {g.user.displayName.split(' ')[0]}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
