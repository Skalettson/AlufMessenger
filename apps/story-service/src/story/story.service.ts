import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, and, gt, inArray, sql, desc, count } from 'drizzle-orm';
import { stories, storyViews, contacts, users } from '@aluf/db';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  STORY_TTL_HOURS,
} from '@aluf/shared';
import type { StoryPrivacySettings } from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';

function pickUserAvatarUrl(
  avatarStorageKey: string | null | undefined,
  avatarUrl: string | null | undefined,
): string | null {
  const a = (avatarStorageKey ?? '').trim();
  if (a) {
    if (/^https?:\/\//i.test(a)) return a;
    if (a.startsWith('/')) return a;
    if (/^\d{4}\/\d{2}\/\d{2}\//.test(a)) return `/${a}`;
    return a;
  }
  const b = (avatarUrl ?? '').trim();
  return b || null;
}

/** Как в Telegram: 6, 12, 24, 48 ч (премиум — все; бесплатно — только 24). */
const ALLOWED_TTL_HOURS_FREE = [24] as const;
const ALLOWED_TTL_HOURS_PREMIUM = [6, 12, 24, 48] as const;

export interface UserStoryGroupRow {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  stories: Array<{
    id: string;
    userId: string;
    mediaId: string;
    caption: string | null;
    privacy: unknown;
    viewCount: number;
    expiresAt: Date;
    createdAt: Date;
    viewed: boolean;
  }>;
  hasUnseen: boolean;
  latestStoryAt: Date;
}

@Injectable()
export class StoryService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
  ) {}

  private async getIsPremium(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ isPremium: users.isPremium })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.isPremium ?? false;
  }

  async createStory(
    userId: string,
    mediaId: string,
    caption?: string,
    privacy?: StoryPrivacySettings,
    ttlHours: number = STORY_TTL_HOURS,
  ) {
    if (!mediaId?.trim()) {
      throw new BadRequestError('mediaId обязателен');
    }

    const isPremium = await this.getIsPremium(userId);
    const allowed = isPremium ? ALLOWED_TTL_HOURS_PREMIUM : ALLOWED_TTL_HOURS_FREE;
    if (!(allowed as readonly number[]).includes(ttlHours)) {
      throw new BadRequestError(
        `TTL допустим: ${allowed.join(', ')} ч для вашего плана`,
      );
    }

    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const [story] = await this.db
      .insert(stories)
      .values({
        userId,
        mediaId,
        caption: caption ?? null,
        privacy: privacy ?? { level: 'everyone' },
        expiresAt,
      })
      .returning();

    return story!;
  }

  /** Лента как в Telegram: сначала свои истории, затем группы контактов. */
  async getStoriesFeed(viewerId: string): Promise<UserStoryGroupRow[]> {
    const feed: UserStoryGroupRow[] = [];
    const myGroup = await this.getUserStoriesGroup(viewerId, viewerId);
    if (myGroup) feed.push(myGroup);

    const contactRows = await this.db
      .select({ contactUserId: contacts.contactUserId, customName: contacts.customName })
      .from(contacts)
      .where(and(eq(contacts.userId, viewerId), eq(contacts.isBlocked, false)));

    const contactIds = contactRows.map((c) => c.contactUserId);
    const contactDisplayName = new Map(
      contactRows.map((c) => [c.contactUserId, (c.customName ?? '').trim()]),
    );
    if (contactIds.length === 0) return feed;

    const now = new Date();
    const allStories = await this.db
      .select()
      .from(stories)
      .where(and(inArray(stories.userId, contactIds), gt(stories.expiresAt, now)))
      .orderBy(desc(stories.createdAt));

    const visibleStories = allStories.filter((s) =>
      this.isVisibleByPrivacy(s.privacy as StoryPrivacySettings, viewerId),
    );

    const viewedStoryIds = await this.db
      .select({ storyId: storyViews.storyId })
      .from(storyViews)
      .where(eq(storyViews.viewerId, viewerId));
    const viewedSet = new Set(viewedStoryIds.map((v) => v.storyId));

    const userRows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarStorageKey: users.avatarStorageKey,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(inArray(users.id, contactIds));

    const userMap = new Map(userRows.map((u) => [u.id, u]));

    const byUser = new Map<string, typeof visibleStories>();
    for (const s of visibleStories) {
      if (!byUser.has(s.userId)) byUser.set(s.userId, []);
      byUser.get(s.userId)!.push(s);
    }

    const groups: UserStoryGroupRow[] = [];
    for (const [uid, list] of byUser) {
      const user = userMap.get(uid);
      const custom = contactDisplayName.get(uid) ?? '';
      const storiesSorted = [...list].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const hasUnseen = storiesSorted.some((s) => !viewedSet.has(s.id));
      const latestStoryAt = storiesSorted[storiesSorted.length - 1]?.createdAt ?? new Date(0);

      groups.push({
        userId: uid,
        username: user?.username ?? '',
        displayName: custom.length > 0 ? custom : (user?.displayName ?? ''),
        avatarUrl: user ? pickUserAvatarUrl(user.avatarStorageKey, user.avatarUrl) : null,
        stories: storiesSorted.map((s) => ({
          id: s.id,
          userId: s.userId,
          mediaId: s.mediaId,
          caption: s.caption,
          privacy: s.privacy,
          viewCount: s.viewCount,
          expiresAt: s.expiresAt,
          createdAt: s.createdAt,
          viewed: viewedSet.has(s.id),
        })),
        hasUnseen,
        latestStoryAt,
      });
    }

    groups.sort((a, b) => b.latestStoryAt.getTime() - a.latestStoryAt.getTime());
    return [...feed, ...groups];
  }

  /** Истории одного пользователя (для открытия по клику на круг). */
  async getUserStoriesGroup(
    viewerId: string,
    targetUserId: string,
  ): Promise<UserStoryGroupRow | null> {
    const now = new Date();
    const list = await this.db
      .select()
      .from(stories)
      .where(and(eq(stories.userId, targetUserId), gt(stories.expiresAt, now)))
      .orderBy(stories.createdAt);

    const visible = list.filter((s) =>
      this.isVisibleByPrivacy(s.privacy as StoryPrivacySettings, viewerId),
    );
    if (visible.length === 0) return null;

    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarStorageKey: users.avatarStorageKey,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    let displayNameForViewer = user?.displayName ?? '';
    if (viewerId && viewerId !== targetUserId) {
      const [cRow] = await this.db
        .select({ customName: contacts.customName })
        .from(contacts)
        .where(and(eq(contacts.userId, viewerId), eq(contacts.contactUserId, targetUserId)))
        .limit(1);
      const cn = cRow?.customName?.trim();
      if (cn) displayNameForViewer = cn;
    }

    const viewedRows = await this.db
      .select({ storyId: storyViews.storyId })
      .from(storyViews)
      .where(
        and(
          eq(storyViews.viewerId, viewerId),
          inArray(
            storyViews.storyId,
            visible.map((s) => s.id),
          ),
        ),
      );
    const viewedSet = new Set(viewedRows.map((r) => r.storyId));
    const latestStoryAt = visible[visible.length - 1]!.createdAt;
    /** Свои истории: не помечаем «непросмотренные» (владелец не пишет себе story_views). */
    const hasUnseen =
      viewerId === targetUserId ? false : visible.some((s) => !viewedSet.has(s.id));

    return {
      userId: targetUserId,
      username: user?.username ?? '',
      displayName: displayNameForViewer,
      avatarUrl: user ? pickUserAvatarUrl(user.avatarStorageKey, user.avatarUrl) : null,
      stories: visible.map((s) => ({
        id: s.id,
        userId: s.userId,
        mediaId: s.mediaId,
        caption: s.caption,
        privacy: s.privacy,
        viewCount: s.viewCount,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
        viewed: viewedSet.has(s.id),
      })),
      hasUnseen,
      latestStoryAt,
    };
  }

  /** Отметить просмотр. Счётчик просмотров = число уникальных зрителей (как в Telegram). */
  async viewStory(storyId: string, viewerId: string): Promise<void> {
    const story = await this.requireStory(storyId);
    if (story.userId === viewerId) return;

    await this.db
      .insert(storyViews)
      .values({ storyId, viewerId })
      .onConflictDoNothing();

    const [row] = await this.db
      .select({ count: count() })
      .from(storyViews)
      .where(eq(storyViews.storyId, storyId));
    await this.db
      .update(stories)
      .set({ viewCount: Number(row?.count ?? 0) })
      .where(eq(stories.id, storyId));
  }

  /** Список кто смотрел историю (только для автора). */
  async getStoryViewsList(storyId: string, ownerId: string) {
    const story = await this.requireStory(storyId);
    if (story.userId !== ownerId) {
      throw new ForbiddenError('Только автор может смотреть список просмотров');
    }

    const rows = await this.db
      .select({
        viewerId: storyViews.viewerId,
        viewedAt: storyViews.viewedAt,
        reaction: storyViews.reaction,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(storyViews)
      .innerJoin(users, eq(users.id, storyViews.viewerId))
      .where(eq(storyViews.storyId, storyId))
      .orderBy(desc(storyViews.viewedAt));

    return rows.map((r) => ({
      userId: r.viewerId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      viewedAt: r.viewedAt,
      reactionEmoji: r.reaction ?? '',
    }));
  }

  /** Владелец истории + превью для ответа в чат (как в Telegram). */
  async getStoryOwner(storyId: string): Promise<{
    ownerUserId: string;
    mediaId: string;
    caption: string | null;
    ownerDisplayName: string;
  }> {
    const story = await this.requireStory(storyId);
    const [owner] = await this.db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, story.userId))
      .limit(1);
    return {
      ownerUserId: story.userId,
      mediaId: story.mediaId,
      caption: story.caption ?? null,
      ownerDisplayName: owner?.displayName ?? '',
    };
  }

  async reactToStory(storyId: string, viewerId: string, emoji: string): Promise<void> {
    await this.requireStory(storyId);
    if (!emoji?.trim()) throw new BadRequestError('Эмодзи обязателен');

    await this.db
      .insert(storyViews)
      .values({ storyId, viewerId, reaction: emoji.trim().slice(0, 10) })
      .onConflictDoUpdate({
        target: [storyViews.storyId, storyViews.viewerId],
        set: { reaction: emoji.trim().slice(0, 10) },
      });
  }

  async deleteStory(storyId: string, userId: string): Promise<void> {
    const story = await this.requireStory(storyId);
    if (story.userId !== userId) {
      throw new ForbiddenError('Можно удалять только свои истории');
    }
    await this.db.delete(storyViews).where(eq(storyViews.storyId, storyId));
    await this.db.delete(stories).where(eq(stories.id, storyId));
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredStories(): Promise<void> {
    const now = new Date();
    const expired = await this.db
      .select({ id: stories.id })
      .from(stories)
      .where(sql`${stories.expiresAt} < ${now}`);

    if (expired.length === 0) return;
    const ids = expired.map((s) => s.id);
    await this.db.delete(storyViews).where(inArray(storyViews.storyId, ids));
    await this.db.delete(stories).where(inArray(stories.id, ids));
    console.log(`[Story] Cleaned up ${expired.length} expired stories`);
  }

  private isVisibleByPrivacy(
    privacy: StoryPrivacySettings | null | undefined,
    viewerId: string,
  ): boolean {
    if (!privacy?.level || privacy.level === 'everyone') return true;
    if (privacy.level === 'contacts') return true;
    if (privacy.level === 'selected') {
      return (privacy.allowedUserIds?.includes(viewerId)) ?? false;
    }
    if (privacy.level === 'except') {
      return !(privacy.excludedUserIds?.includes(viewerId) ?? false);
    }
    return true;
  }

  private async requireStory(storyId: string) {
    const [story] = await this.db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1);
    if (!story) throw new NotFoundError('Story', storyId);
    return story;
  }
}
