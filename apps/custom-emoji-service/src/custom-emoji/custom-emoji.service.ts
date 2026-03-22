import { Injectable, Inject } from '@nestjs/common';
import { eq, and, inArray, desc, ilike } from 'drizzle-orm';
import { customEmoji, userCustomEmoji, mediaFiles } from '@aluf/db';
import { SUPPORTED_STICKER_EMOJI_TYPES } from '@aluf/shared';
import { NotFoundError, ForbiddenError, BadRequestError } from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';

const SHORTCODE_REGEX = /^:[\w+_-]+:$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeShortcode(s: string): string {
  const t = (s ?? '').trim();
  if (t.startsWith(':') && t.endsWith(':')) return t;
  if (t.length > 0) return `:${t}:`;
  return t;
}

@Injectable()
export class CustomEmojiService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
  ) {}

  async createEmoji(creatorId: string, mediaId: string, shortcode: string) {
    if (!creatorId?.trim()) {
      throw new BadRequestError('creator_id обязателен');
    }
    if (!mediaId?.trim()) {
      throw new BadRequestError('media_id обязателен');
    }
    const cid = creatorId.trim();
    const mid = mediaId.trim();
    if (!UUID_REGEX.test(cid)) {
      throw new BadRequestError('Некорректный creator_id (ожидается UUID)');
    }
    if (!UUID_REGEX.test(mid)) {
      throw new BadRequestError('Некорректный media_id (ожидается UUID)');
    }

    const code = normalizeShortcode(shortcode);
    if (!code || code.length < 3) {
      throw new BadRequestError('Короткий код должен быть в формате :name:');
    }
    if (!SHORTCODE_REGEX.test(code)) {
      throw new BadRequestError('Короткий код может содержать только буквы, цифры, +, _, -');
    }

    const [media] = await this.db
      .select({ id: mediaFiles.id, uploaderId: mediaFiles.uploaderId, mimeType: mediaFiles.mimeType })
      .from(mediaFiles)
      .where(eq(mediaFiles.id, mid))
      .limit(1);
    if (!media) throw new NotFoundError('Медиа', mid);
    if (media.uploaderId !== cid) {
      throw new ForbiddenError('Медиа должно быть загружено вами');
    }
    const isAllowed = (SUPPORTED_STICKER_EMOJI_TYPES as readonly string[]).includes(media.mimeType);
    if (!isAllowed) {
      throw new BadRequestError('Эмодзи должен быть изображением (JPEG, PNG, GIF, WebP) или видео WebM');
    }

    const [existing] = await this.db
      .select({ id: customEmoji.id })
      .from(customEmoji)
      .where(eq(customEmoji.shortcode, code))
      .limit(1);
    if (existing) {
      throw new BadRequestError('Такой короткий код уже занят');
    }

    const [emoji] = await this.db
      .insert(customEmoji)
      .values({ creatorId: cid, mediaId: mid, shortcode: code })
      .returning();
    if (!emoji) throw new BadRequestError('Не удалось создать эмодзи');
    return { ...emoji, url: '' };
  }

  async listMyEmoji(userId: string) {
    const added = await this.db
      .select({ emojiId: userCustomEmoji.customEmojiId })
      .from(userCustomEmoji)
      .where(eq(userCustomEmoji.userId, userId));
    const addedIds = added.map((a) => a.emojiId);
    const created = await this.db
      .select()
      .from(customEmoji)
      .where(eq(customEmoji.creatorId, userId))
      .orderBy(desc(customEmoji.createdAt));
    const createdIds = new Set(created.map((c) => c.id));
    const otherIds = addedIds.filter((id) => !createdIds.has(id));
    let other: typeof created = [];
    if (otherIds.length > 0) {
      other = await this.db
        .select()
        .from(customEmoji)
        .where(inArray(customEmoji.id, otherIds))
        .orderBy(desc(customEmoji.createdAt));
    }
    return [...created, ...other].map((e) => ({ ...e, url: '' }));
  }

  async listPublicEmoji(search?: string, limit = 50, offset = 0) {
    const where = search?.trim()
      ? ilike(customEmoji.shortcode, '%' + search.trim() + '%')
      : undefined;
    const rows = await this.db
      .select()
      .from(customEmoji)
      .where(where)
      .orderBy(desc(customEmoji.createdAt))
      .limit(Math.min(limit, 100))
      .offset(offset);
    return rows.map((e) => ({ ...e, url: '' }));
  }

  async addEmojiToMe(userId: string, emojiId: string) {
    const [emoji] = await this.db
      .select()
      .from(customEmoji)
      .where(eq(customEmoji.id, emojiId))
      .limit(1);
    if (!emoji) throw new NotFoundError('Эмодзи', emojiId);
    await this.db
      .insert(userCustomEmoji)
      .values({ userId, customEmojiId: emojiId })
      .onConflictDoNothing();
    return {};
  }

  async removeEmojiFromMe(userId: string, emojiId: string) {
    await this.db
      .delete(userCustomEmoji)
      .where(
        and(
          eq(userCustomEmoji.userId, userId),
          eq(userCustomEmoji.customEmojiId, emojiId),
        ),
      );
    return {};
  }

  async getEmojiByShortcode(shortcode: string) {
    const code = normalizeShortcode(shortcode);
    if (!code) return null;
    const [emoji] = await this.db
      .select()
      .from(customEmoji)
      .where(eq(customEmoji.shortcode, code))
      .limit(1);
    if (!emoji) return null;
    return { ...emoji, url: '' };
  }

  async getEmojiByIds(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.db
      .select()
      .from(customEmoji)
      .where(inArray(customEmoji.id, ids));
    return rows.map((e) => ({ ...e, url: '' }));
  }

  async deleteEmoji(emojiId: string, userId: string) {
    const [emoji] = await this.db
      .select()
      .from(customEmoji)
      .where(eq(customEmoji.id, emojiId))
      .limit(1);
    if (!emoji) throw new NotFoundError('Эмодзи', emojiId);
    if (emoji.creatorId !== userId) {
      throw new ForbiddenError('Только создатель может удалить эмодзи');
    }
    await this.db.delete(userCustomEmoji).where(eq(userCustomEmoji.customEmojiId, emojiId));
    await this.db.delete(customEmoji).where(eq(customEmoji.id, emojiId));
    return {};
  }
}
