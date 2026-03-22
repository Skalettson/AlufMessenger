import { Injectable, Inject } from '@nestjs/common';
import { eq, and, inArray, desc, ilike, asc } from 'drizzle-orm';
import {
  stickerPacks,
  userStickerPacks,
  mediaFiles,
} from '@aluf/db';
import { NotFoundError, ForbiddenError, BadRequestError } from '@aluf/shared';
import { SUPPORTED_STICKER_EMOJI_TYPES } from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PackRow = (typeof stickerPacks)['$inferSelect'];

@Injectable()
export class StickerService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
  ) {}

  /** Для превью в списках: обложка или первый стикер по дате добавления. */
  private async enrichPacksWithPreviewMediaId(
    packs: Array<PackRow & { isMine?: boolean; addedToMe?: boolean }>,
  ): Promise<Array<PackRow & { isMine?: boolean; addedToMe?: boolean; previewMediaId: string | null }>> {
    const missingCover = packs.filter((p) => !p.coverMediaId).map((p) => p.id);
    const firstByPack = new Map<string, string>();
    if (missingCover.length > 0) {
      const rows = await this.db
        .select({
          packId: mediaFiles.stickerPackId,
          mediaId: mediaFiles.id,
          createdAt: mediaFiles.createdAt,
        })
        .from(mediaFiles)
        .where(inArray(mediaFiles.stickerPackId, missingCover))
        .orderBy(asc(mediaFiles.stickerPackId), asc(mediaFiles.createdAt));
      for (const r of rows) {
        const pid = r.packId;
        if (pid && !firstByPack.has(pid)) {
          firstByPack.set(pid, r.mediaId);
        }
      }
    }
    return packs.map((p) => ({
      ...p,
      previewMediaId: p.coverMediaId ?? firstByPack.get(p.id) ?? null,
    }));
  }

  async createPack(
    creatorId: string,
    name: string,
    isPublic: boolean = true,
    description?: string,
  ) {
    if (!creatorId?.trim()) {
      throw new BadRequestError('creator_id обязателен');
    }
    const cid = creatorId.trim();
    if (!UUID_REGEX.test(cid)) {
      throw new BadRequestError('Некорректный creator_id (ожидается UUID)');
    }
    const nameTrim = (name ?? '').trim();
    if (!nameTrim) throw new BadRequestError('Название пака обязательно');
    const [pack] = await this.db
      .insert(stickerPacks)
      .values({
        creatorId: cid,
        name: nameTrim,
        isPublic: !!isPublic,
        description: description?.trim() || null,
      })
      .returning();
    if (!pack) throw new BadRequestError('Не удалось создать пак');
    return pack;
  }

  async addStickerToPack(packId: string, mediaId: string, userId: string) {
    if (!packId?.trim() || !UUID_REGEX.test(packId.trim())) {
      throw new BadRequestError('Некорректный pack_id (ожидается UUID)');
    }
    if (!mediaId?.trim() || !UUID_REGEX.test(mediaId.trim())) {
      throw new BadRequestError('Некорректный media_id (ожидается UUID)');
    }
    if (!userId?.trim() || !UUID_REGEX.test(userId.trim())) {
      throw new BadRequestError('Некорректный user_id (ожидается UUID)');
    }
    const pid = packId.trim();
    const mid = mediaId.trim();
    const uid = userId.trim();
    const [pack] = await this.db
      .select()
      .from(stickerPacks)
      .where(eq(stickerPacks.id, pid))
      .limit(1);
    if (!pack) throw new NotFoundError('Пак стикеров', pid);
    if (pack.creatorId !== uid) {
      throw new ForbiddenError('Только создатель пака может добавлять стикеры');
    }
    const [media] = await this.db
      .select({ id: mediaFiles.id, mimeType: mediaFiles.mimeType })
      .from(mediaFiles)
      .where(and(eq(mediaFiles.id, mid), eq(mediaFiles.uploaderId, uid)))
      .limit(1);
    if (!media) {
      throw new BadRequestError('Медиа не найдено или загружено другим пользователем');
    }
    const allowedTypes = SUPPORTED_STICKER_EMOJI_TYPES as readonly string[];
    if (!allowedTypes.includes(media.mimeType)) {
      throw new BadRequestError('Стикер должен быть изображением (JPEG, PNG, GIF, WebP) или видео WebM');
    }
    await this.db
      .update(mediaFiles)
      .set({ stickerPackId: pid })
      .where(
        and(
          eq(mediaFiles.id, mid),
          eq(mediaFiles.uploaderId, uid),
        ),
      );
    return {};
  }

  async listMyPacks(userId: string) {
    if (!userId?.trim()) throw new BadRequestError('user_id обязателен');
    const uid = userId.trim();
    if (!UUID_REGEX.test(uid)) throw new BadRequestError('Некорректный user_id (ожидается UUID)');
    const created = await this.db
      .select()
      .from(stickerPacks)
      .where(eq(stickerPacks.creatorId, uid))
      .orderBy(desc(stickerPacks.createdAt));

    const added = await this.db
      .select({
        packId: userStickerPacks.stickerPackId,
      })
      .from(userStickerPacks)
      .where(eq(userStickerPacks.userId, uid));
    const addedIds = new Set(added.map((a) => a.packId));

    const createdIds = new Set(created.map((c) => c.id));
    const addedOnlyIds = [...addedIds].filter((id) => !createdIds.has(id));
    let addedPacks: typeof created = [];
    if (addedOnlyIds.length > 0) {
      addedPacks = await this.db
        .select()
        .from(stickerPacks)
        .where(inArray(stickerPacks.id, addedOnlyIds))
        .orderBy(desc(stickerPacks.createdAt));
    }

    const allPacks = [...created, ...addedPacks];
    const mapped = allPacks.map((p) => ({
      ...p,
      isMine: p.creatorId === uid,
      addedToMe: p.creatorId === uid || addedIds.has(p.id),
    }));
    return this.enrichPacksWithPreviewMediaId(mapped);
  }

  async listPublicPacks(search?: string, limit: number = 50, offset: number = 0) {
    const where = search?.trim()
      ? and(eq(stickerPacks.isPublic, true), ilike(stickerPacks.name, '%' + search.trim() + '%'))
      : eq(stickerPacks.isPublic, true);
    const q = this.db
      .select()
      .from(stickerPacks)
      .where(where)
      .orderBy(desc(stickerPacks.createdAt))
      .limit(Math.min(limit, 100))
      .offset(offset);
    const packs = await q;
    const mapped = packs.map((p) => ({
      ...p,
      isMine: false,
      addedToMe: false,
    }));
    return this.enrichPacksWithPreviewMediaId(mapped);
  }

  async addPackToMe(userId: string, packId: string) {
    if (!userId?.trim() || !UUID_REGEX.test(userId.trim())) {
      throw new BadRequestError('Некорректный user_id (ожидается UUID)');
    }
    if (!packId?.trim() || !UUID_REGEX.test(packId.trim())) {
      throw new BadRequestError('Некорректный pack_id (ожидается UUID)');
    }
    const uid = userId.trim();
    const pid = packId.trim();
    const [pack] = await this.db
      .select()
      .from(stickerPacks)
      .where(eq(stickerPacks.id, pid))
      .limit(1);
    if (!pack) throw new NotFoundError('Пак стикеров', pid);
    if (!pack.isPublic) {
      throw new ForbiddenError('Пак не публичный');
    }
    await this.db
      .insert(userStickerPacks)
      .values({ userId: uid, stickerPackId: pid })
      .onConflictDoNothing();
    return {};
  }

  async removePackFromMe(userId: string, packId: string) {
    if (!userId?.trim() || !UUID_REGEX.test(userId.trim())) {
      throw new BadRequestError('Некорректный user_id (ожидается UUID)');
    }
    if (!packId?.trim() || !UUID_REGEX.test(packId.trim())) {
      throw new BadRequestError('Некорректный pack_id (ожидается UUID)');
    }
    await this.db
      .delete(userStickerPacks)
      .where(
        and(
          eq(userStickerPacks.userId, userId.trim()),
          eq(userStickerPacks.stickerPackId, packId.trim()),
        ),
      );
    return {};
  }

  async getPackWithStickers(packId: string): Promise<{
    pack: PackRow & { isMine: boolean; addedToMe: boolean };
    stickers: { mediaId: string; fileName: string; mimeType: string }[];
  }> {
    if (!packId?.trim() || !UUID_REGEX.test(packId.trim())) {
      throw new BadRequestError('Некорректный pack_id (ожидается UUID)');
    }
    const pid = packId.trim();
    const [pack] = await this.db
      .select()
      .from(stickerPacks)
      .where(eq(stickerPacks.id, pid))
      .limit(1);
    if (!pack) throw new NotFoundError('Пак стикеров', pid);
    const stickers = await this.db
      .select({
        mediaId: mediaFiles.id,
        fileName: mediaFiles.fileName,
        mimeType: mediaFiles.mimeType,
      })
      .from(mediaFiles)
      .where(eq(mediaFiles.stickerPackId, pid));
    return {
      pack: {
        ...pack,
        isMine: false,
        addedToMe: false,
      },
      stickers,
    };
  }

  async getPackByStickerMediaId(
    mediaId: string,
    userId: string,
  ): Promise<PackRow & { isMine: boolean; addedToMe: boolean }> {
    if (!mediaId?.trim() || !UUID_REGEX.test(mediaId.trim())) {
      throw new BadRequestError('Некорректный media_id (ожидается UUID)');
    }
    const mid = mediaId.trim();
    const uid = userId?.trim() ?? '';
    const [media] = await this.db
      .select({ stickerPackId: mediaFiles.stickerPackId })
      .from(mediaFiles)
      .where(eq(mediaFiles.id, mid))
      .limit(1);
    if (!media?.stickerPackId) throw new NotFoundError('Стикер не найден или не входит в пак', mid);
    const pid = media.stickerPackId;
    const [pack] = await this.db
      .select()
      .from(stickerPacks)
      .where(eq(stickerPacks.id, pid))
      .limit(1);
    if (!pack) throw new NotFoundError('Пак стикеров', pid);
    let addedToMe = false;
    if (uid && UUID_REGEX.test(uid)) {
      const [link] = await this.db
        .select({ userId: userStickerPacks.userId })
        .from(userStickerPacks)
        .where(and(eq(userStickerPacks.userId, uid), eq(userStickerPacks.stickerPackId, pid)))
        .limit(1);
      addedToMe = !!link;
    }
    return {
      ...pack,
      isMine: pack.creatorId === uid,
      addedToMe,
    };
  }

  async deletePack(packId: string, userId: string) {
    if (!userId?.trim() || !UUID_REGEX.test(userId.trim())) {
      throw new BadRequestError('Некорректный user_id (ожидается UUID)');
    }
    if (!packId?.trim() || !UUID_REGEX.test(packId.trim())) {
      throw new BadRequestError('Некорректный pack_id (ожидается UUID)');
    }
    const pid = packId.trim();
    const uid = userId.trim();
    const [pack] = await this.db
      .select()
      .from(stickerPacks)
      .where(eq(stickerPacks.id, pid))
      .limit(1);
    if (!pack) throw new NotFoundError('Пак стикеров', pid);
    if (pack.creatorId !== uid) {
      throw new ForbiddenError('Только создатель может удалить пак');
    }
    await this.db.update(mediaFiles).set({ stickerPackId: null }).where(eq(mediaFiles.stickerPackId, pid));
    await this.db.delete(userStickerPacks).where(eq(userStickerPacks.stickerPackId, pid));
    await this.db.delete(stickerPacks).where(eq(stickerPacks.id, pid));
    return {};
  }

  async removeStickerFromPack(packId: string, mediaId: string, userId: string) {
    if (!packId?.trim() || !mediaId?.trim() || !userId?.trim()) {
      throw new BadRequestError('pack_id, media_id и user_id обязательны');
    }
    if (!UUID_REGEX.test(packId.trim()) || !UUID_REGEX.test(mediaId.trim()) || !UUID_REGEX.test(userId.trim())) {
      throw new BadRequestError('pack_id, media_id и user_id должны быть в формате UUID');
    }
    const pid = packId.trim();
    const mid = mediaId.trim();
    const uid = userId.trim();
    const [pack] = await this.db
      .select()
      .from(stickerPacks)
      .where(eq(stickerPacks.id, pid))
      .limit(1);
    if (!pack) throw new NotFoundError('Пак стикеров', pid);
    if (pack.creatorId !== uid) {
      throw new ForbiddenError('Только создатель пака может удалять стикеры');
    }
    await this.db
      .update(mediaFiles)
      .set({ stickerPackId: null })
      .where(
        and(
          eq(mediaFiles.id, mid),
          eq(mediaFiles.stickerPackId, pid),
        ),
      );
    return {};
  }
}
