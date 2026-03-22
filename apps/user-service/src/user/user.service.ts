import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, ne, ilike, sql, inArray, gte } from 'drizzle-orm';
import { users, contacts, bots } from '@aluf/db';
import type { DrizzleDB } from '../providers/database.provider';
import { DATABASE_TOKEN } from '../providers/database.provider';
import { REDIS_TOKEN } from '../providers/redis.provider';
import type Redis from 'ioredis';
import { NotFoundError, ConflictError, BadRequestError, ALUF_SYSTEM_USERNAME } from '@aluf/shared';
import { USERNAME_REGEX } from '@aluf/shared';

const PRESENCE_KEY_PREFIX = 'presence:';

export interface UserRow {
  id: string;
  alufId: bigint;
  username: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  avatarStorageKey: string | null;
  coverStorageKey: string | null;
  // Устаревшие поля для обратной совместимости
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  statusText: string | null;
  statusEmoji: string | null;
  premiumBadgeEmoji: string | null;
  isPremium: boolean;
  createdAt: Date;
  lastSeenAt: Date | null;
  twoFactorEnabled?: boolean;
}

export interface ContactRow {
  userId: string;
  contactUserId: string;
  customName: string | null;
  isBlocked: boolean;
  createdAt: Date;
}

export interface PrivacySettingsRow {
  lastSeen?: number;
  profilePhoto?: number;
  about?: number;
  groups?: number;
  calls?: number;
  forwardedMessages?: number;
  readReceipts?: boolean;
}

@Injectable()
export class UserService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
  ) {}

  async getUserById(
    id: string,
    viewerUserId?: string,
  ): Promise<
    (UserRow & { isOnline: boolean; botCommands?: { command: string; description: string }[]; isContact?: boolean }) | null
  > {
    const [row] = await this.db
      .select({
        id: users.id,
        alufId: users.alufId,
        username: users.username,
        displayName: users.displayName,
        phone: users.phone,
        email: users.email,
        avatarStorageKey: users.avatarStorageKey,
        coverStorageKey: users.coverStorageKey,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        statusText: users.statusText,
        statusEmoji: users.statusEmoji,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isPremium: users.isPremium,
        isVerified: users.isVerified,
        isOfficial: users.isOfficial,
        createdAt: users.createdAt,
        lastSeenAt: users.lastSeenAt,
        isBot: users.isBot,
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!row) return null;

    let displayName = row.displayName;
    let isContact = false;
    if (viewerUserId && viewerUserId !== id) {
      const [contactRow] = await this.db
        .select({ customName: contacts.customName, isBlocked: contacts.isBlocked })
        .from(contacts)
        .where(and(eq(contacts.userId, viewerUserId), eq(contacts.contactUserId, id)))
        .limit(1);
      if (contactRow && !contactRow.isBlocked) {
        isContact = true;
        const cn = contactRow.customName?.trim();
        if (cn) displayName = cn;
      }
    }

    let bio = row.bio ?? null;
    let botCommands: { command: string; description: string }[] | undefined;
    if (row.isBot) {
      const [botRow] = await this.db
        .select({ description: bots.description, commands: bots.commands })
        .from(bots)
        .where(eq(bots.id, id))
        .limit(1);
      if (botRow?.description?.trim()) bio = botRow.description.trim();
      const raw = botRow?.commands;
      if (Array.isArray(raw) && raw.length > 0) {
        botCommands = raw
          .filter((c): c is { command?: string; description?: string } => c && typeof c === 'object')
          .map((c) => ({ command: String(c.command ?? '').trim(), description: String(c.description ?? '').trim() }))
          .filter((c) => c.command.length > 0);
      }
    }

    const isOnline = await this.checkOnlineStatus(id);
    return { ...row, displayName, bio, botCommands, isOnline, isContact };
  }

  async getUserByUsername(username: string): Promise<(UserRow & { isOnline: boolean; botCommands?: { command: string; description: string }[] }) | null> {
    const [row] = await this.db
      .select({
        id: users.id,
        alufId: users.alufId,
        username: users.username,
        displayName: users.displayName,
        phone: users.phone,
        email: users.email,
        avatarStorageKey: users.avatarStorageKey,
        coverStorageKey: users.coverStorageKey,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        statusText: users.statusText,
        statusEmoji: users.statusEmoji,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isPremium: users.isPremium,
        isVerified: users.isVerified,
        isOfficial: users.isOfficial,
        createdAt: users.createdAt,
        lastSeenAt: users.lastSeenAt,
        isBot: users.isBot,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!row) return null;

    let bio = row.bio ?? null;
    let botCommands: { command: string; description: string }[] | undefined;
    if (row.isBot) {
      const [botRow] = await this.db
        .select({ description: bots.description, commands: bots.commands })
        .from(bots)
        .where(eq(bots.id, row.id))
        .limit(1);
      if (botRow?.description?.trim()) bio = botRow.description.trim();
      const raw = botRow?.commands;
      if (Array.isArray(raw) && raw.length > 0) {
        botCommands = raw
          .filter((c): c is { command?: string; description?: string } => c && typeof c === 'object')
          .map((c) => ({ command: String(c.command ?? '').trim(), description: String(c.description ?? '').trim() }))
          .filter((c) => c.command.length > 0);
      }
    }

    const isOnline = await this.checkOnlineStatus(row.id);
    return { ...row, bio, botCommands, isOnline };
  }

  async getUsersByIds(ids: string[]): Promise<(UserRow & { isOnline: boolean })[]> {
    if (ids.length === 0) return [];

    const rows = await this.db
      .select({
        id: users.id,
        alufId: users.alufId,
        username: users.username,
        displayName: users.displayName,
        phone: users.phone,
        email: users.email,
        avatarStorageKey: users.avatarStorageKey,
        coverStorageKey: users.coverStorageKey,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        statusText: users.statusText,
        statusEmoji: users.statusEmoji,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isPremium: users.isPremium,
        createdAt: users.createdAt,
        lastSeenAt: users.lastSeenAt,
        isBot: users.isBot,
      })
      .from(users)
      .where(inArray(users.id, ids));

    const presenceKeys = rows.map((r) => `${PRESENCE_KEY_PREFIX}${r.id}`);
    const onlineStatuses =
      presenceKeys.length > 0 ? await this.redis.mget(...presenceKeys) : [];
    const onlineSet = new Set(
      onlineStatuses
        .map((v, i) => (v ? rows[i]?.id : null))
        .filter((id): id is string => id != null),
    );

    const rowMap = new Map(rows.map((r) => [r.id, r]));
    return ids
      .filter((id) => rowMap.has(id))
      .map((id) => {
        const row = rowMap.get(id)!;
        return { ...row, isOnline: onlineSet.has(row.id) };
      });
  }

  async updateProfile(
    userId: string,
    data: {
      displayName?: string;
      username?: string;
      bio?: string;
      avatarUrl?: string;
      coverUrl?: string;
      avatarStorageKey?: string;
      coverStorageKey?: string;
      statusText?: string;
      statusEmoji?: string;
      premiumBadgeEmoji?: string | null;
    },
  ): Promise<UserRow> {
    if (data.username !== undefined) {
      if (!USERNAME_REGEX.test(data.username)) {
        throw new BadRequestError('Invalid username format');
      }
      const [existing] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, data.username))
        .limit(1);
      if (existing && existing.id !== userId) {
        throw new ConflictError('Username already taken');
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl;
    if (data.avatarStorageKey !== undefined) updateData.avatarStorageKey = data.avatarStorageKey;
    if (data.coverStorageKey !== undefined) updateData.coverStorageKey = data.coverStorageKey;
    if (data.statusText !== undefined) updateData.statusText = data.statusText;
    if (data.statusEmoji !== undefined) updateData.statusEmoji = data.statusEmoji;
    if (data.premiumBadgeEmoji !== undefined) {
      const [current] = await this.db.select({ isPremium: users.isPremium }).from(users).where(eq(users.id, userId)).limit(1);
      if (!current?.isPremium) {
        throw new BadRequestError('Кастомный бейдж доступен только с подпиской Premium');
      }
      const val = data.premiumBadgeEmoji === null || data.premiumBadgeEmoji === '' ? null : String(data.premiumBadgeEmoji).trim().slice(0, 16);
      updateData.premiumBadgeEmoji = val || null;
    }

    const [updated] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        alufId: users.alufId,
        username: users.username,
        displayName: users.displayName,
        phone: users.phone,
        email: users.email,
        avatarStorageKey: users.avatarStorageKey,
        coverStorageKey: users.coverStorageKey,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        statusText: users.statusText,
        statusEmoji: users.statusEmoji,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isPremium: users.isPremium,
        createdAt: users.createdAt,
        lastSeenAt: users.lastSeenAt,
      });

    if (!updated) {
      throw new NotFoundError('User not found');
    }
    return updated;
  }

  async adminUpdateUser(
    userId: string,
    data: {
      isVerified?: boolean;
      isOfficial?: boolean;
      isPremium?: boolean;
      isBot?: boolean;
    },
  ): Promise<UserRow> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.isVerified !== undefined) updateData.isVerified = data.isVerified;
    if (data.isOfficial !== undefined) updateData.isOfficial = data.isOfficial;
    if (data.isPremium !== undefined) updateData.isPremium = data.isPremium;
    if (data.isBot !== undefined) updateData.isBot = data.isBot;

    const [updated] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        alufId: users.alufId,
        username: users.username,
        displayName: users.displayName,
        phone: users.phone,
        email: users.email,
        avatarStorageKey: users.avatarStorageKey,
        coverStorageKey: users.coverStorageKey,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        statusText: users.statusText,
        statusEmoji: users.statusEmoji,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isPremium: users.isPremium,
        createdAt: users.createdAt,
        lastSeenAt: users.lastSeenAt,
      });

    if (!updated) throw new NotFoundError('User not found');
    return updated;
  }

  async searchUsers(
    query: string,
    limit: number,
    offset: number,
  ): Promise<{ users: (UserRow & { isOnline: boolean })[]; totalCount: number }> {
    const q = (query ?? '').trim();
    if (!q) return { users: [], totalCount: 0 };
    const pattern = `%${q}%`;
    const searchMatch = or(
      ilike(users.username, pattern),
      ilike(users.displayName, pattern),
    );
    const where = and(searchMatch, ne(users.username, ALUF_SYSTEM_USERNAME));

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(where);

    const totalCount = countResult?.count ?? 0;

    const rows = await this.db
      .select({
        id: users.id,
        alufId: users.alufId,
        username: users.username,
        displayName: users.displayName,
        phone: users.phone,
        email: users.email,
        avatarStorageKey: users.avatarStorageKey,
        coverStorageKey: users.coverStorageKey,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        statusText: users.statusText,
        statusEmoji: users.statusEmoji,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isPremium: users.isPremium,
        createdAt: users.createdAt,
        lastSeenAt: users.lastSeenAt,
        isBot: users.isBot,
      })
      .from(users)
      .where(where)
      .limit(limit)
      .offset(offset);

    const presenceKeys = rows.map((r) => `${PRESENCE_KEY_PREFIX}${r.id}`);
    const onlineStatuses =
      presenceKeys.length > 0 ? await this.redis.mget(...presenceKeys) : [];
    const onlineSet = new Set(
      onlineStatuses
        .map((v, i) => (v ? rows[i]?.id : null))
        .filter((id): id is string => id != null),
    );

    const usersWithOnline = rows.map((row) => ({
      ...row,
      isOnline: onlineSet.has(row.id),
    }));

    return { users: usersWithOnline, totalCount };
  }

  /** Список пользователей для админки (пагинация, опциональный поиск). */
  async listUsers(
    limit: number,
    offset: number,
    search?: string,
  ): Promise<{ users: (UserRow & { isOnline: boolean })[]; totalCount: number }> {
    const lim = Math.min(Math.max(1, limit || 20), 100);
    const off = Math.max(0, offset || 0);
    const q = (search ?? '').trim();
    const conditions = [ne(users.username, ALUF_SYSTEM_USERNAME)];
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(users.username, pattern),
          ilike(users.displayName, pattern),
        )!,
      );
    }
    const where = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(where);
    const totalCount = countResult?.count ?? 0;

    const rows = await this.db
      .select({
        id: users.id,
        alufId: users.alufId,
        username: users.username,
        displayName: users.displayName,
        phone: users.phone,
        email: users.email,
        avatarStorageKey: users.avatarStorageKey,
        coverStorageKey: users.coverStorageKey,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        statusText: users.statusText,
        statusEmoji: users.statusEmoji,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isPremium: users.isPremium,
        createdAt: users.createdAt,
        lastSeenAt: users.lastSeenAt,
        isBot: users.isBot,
      })
      .from(users)
      .where(where)
      .limit(lim)
      .offset(off);

    const presenceKeys = rows.map((r) => `${PRESENCE_KEY_PREFIX}${r.id}`);
    const onlineStatuses =
      presenceKeys.length > 0 ? await this.redis.mget(...presenceKeys) : [];
    const onlineSet = new Set(
      onlineStatuses
        .map((v, i) => (v ? rows[i]?.id : null))
        .filter((id): id is string => id != null),
    );

    const usersWithOnline = rows.map((row) => ({
      ...row,
      isOnline: onlineSet.has(row.id),
    }));

    return { users: usersWithOnline, totalCount };
  }

  /** Статистика для админки (без проверки прав — только gateway AdminGuard). */
  async getAdminStats(): Promise<{ totalUsers: number; newUsers24h: number }> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(ne(users.username, ALUF_SYSTEM_USERNAME));
    const [new24Row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(ne(users.username, ALUF_SYSTEM_USERNAME), gte(users.createdAt, since24h)));
    return {
      totalUsers: totalRow?.count ?? 0,
      newUsers24h: new24Row?.count ?? 0,
    };
  }

  async getContacts(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ contacts: (ContactRow & { contactUser: UserRow })[]; totalCount: number }> {
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(eq(contacts.userId, userId));

    const totalCount = countResult?.count ?? 0;

    const rows = await this.db
      .select({
        userId: contacts.userId,
        contactUserId: contacts.contactUserId,
        customName: contacts.customName,
        isBlocked: contacts.isBlocked,
        createdAt: contacts.createdAt,
        contactId: users.id,
        contactAlufId: users.alufId,
        contactUsername: users.username,
        contactDisplayName: users.displayName,
        contactPhone: users.phone,
        contactEmail: users.email,
        contactAvatarStorageKey: users.avatarStorageKey,
        contactCoverStorageKey: users.coverStorageKey,
        contactAvatarUrl: users.avatarUrl,
        contactCoverUrl: users.coverUrl,
        contactBio: users.bio,
        contactStatusText: users.statusText,
        contactStatusEmoji: users.statusEmoji,
        contactPremiumBadgeEmoji: users.premiumBadgeEmoji,
        contactIsPremium: users.isPremium,
        contactIsVerified: users.isVerified,
        contactIsOfficial: users.isOfficial,
        contactIsBot: users.isBot,
        contactCreatedAt: users.createdAt,
        contactLastSeenAt: users.lastSeenAt,
      })
      .from(contacts)
      .innerJoin(users, eq(contacts.contactUserId, users.id))
      .where(eq(contacts.userId, userId))
      .limit(limit)
      .offset(offset);

    const contactIds = rows.map((r) => r.contactUserId);
    const presenceKeys = contactIds.map((id) => `${PRESENCE_KEY_PREFIX}${id}`);
    const onlineStatuses = presenceKeys.length > 0 ? await this.redis.mget(...presenceKeys) : [];
    const onlineSet = new Set(
      onlineStatuses
        .map((v, i) => (v ? contactIds[i] : null))
        .filter((id): id is string => id != null),
    );

    const contactsList = rows.map((r) => ({
      userId: r.userId,
      contactUserId: r.contactUserId,
      customName: r.customName,
      isBlocked: r.isBlocked,
      createdAt: r.createdAt,
      contactUser: {
        id: r.contactId,
        alufId: r.contactAlufId,
        username: r.contactUsername,
        displayName: r.contactDisplayName,
        phone: r.contactPhone,
        email: r.contactEmail,
        avatarStorageKey: r.contactAvatarStorageKey,
        coverStorageKey: r.contactCoverStorageKey,
        avatarUrl: r.contactAvatarUrl,
        coverUrl: r.contactCoverUrl,
        bio: r.contactBio,
        statusText: r.contactStatusText,
        statusEmoji: r.contactStatusEmoji,
        premiumBadgeEmoji: r.contactPremiumBadgeEmoji,
        isPremium: r.contactIsPremium,
        isVerified: r.contactIsVerified,
        isOfficial: r.contactIsOfficial,
        isBot: r.contactIsBot,
        createdAt: r.contactCreatedAt,
        lastSeenAt: r.contactLastSeenAt,
        isOnline: onlineSet.has(r.contactUserId),
      } as UserRow & { isOnline: boolean },
    }));

    return { contacts: contactsList, totalCount };
  }

  async addContact(userId: string, contactUserId: string, customName?: string): Promise<ContactRow & { contactUser: UserRow & { isOnline: boolean } }> {
    const [contactUser] = await this.db
      .select({
        id: users.id,
        alufId: users.alufId,
        username: users.username,
        displayName: users.displayName,
        phone: users.phone,
        email: users.email,
        avatarStorageKey: users.avatarStorageKey,
        coverStorageKey: users.coverStorageKey,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        statusText: users.statusText,
        statusEmoji: users.statusEmoji,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isPremium: users.isPremium,
        createdAt: users.createdAt,
        lastSeenAt: users.lastSeenAt,
      })
      .from(users)
      .where(eq(users.id, contactUserId))
      .limit(1);

    if (!contactUser) {
      throw new NotFoundError('Contact user not found');
    }

    if (userId === contactUserId) {
      throw new BadRequestError('Cannot add self as contact');
    }

    const [inserted] = await this.db
      .insert(contacts)
      .values({
        userId,
        contactUserId,
        customName: customName ?? null,
        isBlocked: false,
      })
      .onConflictDoUpdate({
        target: [contacts.userId, contacts.contactUserId],
        set: {
          customName: sql`excluded.custom_name`,
          isBlocked: false,
        },
      })
      .returning({
        userId: contacts.userId,
        contactUserId: contacts.contactUserId,
        customName: contacts.customName,
        isBlocked: contacts.isBlocked,
        createdAt: contacts.createdAt,
      });

    if (!inserted) {
      throw new ConflictError('Failed to add contact');
    }

    const isOnline = await this.checkOnlineStatus(contactUserId);
    return {
      ...inserted,
      contactUser: { ...contactUser, isOnline },
    };
  }

  async updateContactNickname(
    userId: string,
    contactUserId: string,
    customName: string | null,
  ): Promise<ContactRow & { contactUser: UserRow & { isOnline: boolean } }> {
    const [existing] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.contactUserId, contactUserId)))
      .limit(1);
    if (!existing) {
      throw new NotFoundError('Contact not found');
    }

    const [updated] = await this.db
      .update(contacts)
      .set({ customName: customName?.trim() ? customName.trim() : null })
      .where(and(eq(contacts.userId, userId), eq(contacts.contactUserId, contactUserId)))
      .returning({
        userId: contacts.userId,
        contactUserId: contacts.contactUserId,
        customName: contacts.customName,
        isBlocked: contacts.isBlocked,
        createdAt: contacts.createdAt,
      });

    const [contactUser] = await this.db
      .select({
        id: users.id,
        alufId: users.alufId,
        username: users.username,
        displayName: users.displayName,
        phone: users.phone,
        email: users.email,
        avatarStorageKey: users.avatarStorageKey,
        coverStorageKey: users.coverStorageKey,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        statusText: users.statusText,
        statusEmoji: users.statusEmoji,
        premiumBadgeEmoji: users.premiumBadgeEmoji,
        isPremium: users.isPremium,
        createdAt: users.createdAt,
        lastSeenAt: users.lastSeenAt,
      })
      .from(users)
      .where(eq(users.id, contactUserId))
      .limit(1);

    if (!contactUser) {
      throw new NotFoundError('Contact user not found');
    }

    const isOnline = await this.checkOnlineStatus(contactUserId);
    return {
      ...(updated ?? existing),
      contactUser: { ...contactUser, isOnline },
    };
  }

  async removeContact(userId: string, contactUserId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.contactUserId, contactUserId)))
      .returning({ userId: contacts.userId });

    if (!deleted) {
      throw new NotFoundError('Contact not found');
    }
  }

  async blockUser(userId: string, targetId: string): Promise<void> {
    await this.db
      .insert(contacts)
      .values({
        userId,
        contactUserId: targetId,
        isBlocked: true,
      })
      .onConflictDoUpdate({
        target: [contacts.userId, contacts.contactUserId],
        set: { isBlocked: true },
      });
  }

  async unblockUser(userId: string, targetId: string): Promise<void> {
    await this.db
      .update(contacts)
      .set({ isBlocked: false })
      .where(and(eq(contacts.userId, userId), eq(contacts.contactUserId, targetId)));
  }

  async updatePrivacy(userId: string, settings: PrivacySettingsRow): Promise<void> {
    const [current] = await this.db
      .select({ privacySettings: users.privacySettings })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!current) {
      throw new NotFoundError('User not found');
    }

    const existing = (current.privacySettings as Record<string, unknown>) ?? {};
    const merged = {
      ...existing,
      ...(settings.lastSeen !== undefined && { lastSeen: settings.lastSeen }),
      ...(settings.profilePhoto !== undefined && { profilePhoto: settings.profilePhoto }),
      ...(settings.about !== undefined && { about: settings.about }),
      ...(settings.groups !== undefined && { groups: settings.groups }),
      ...(settings.calls !== undefined && { calls: settings.calls }),
      ...(settings.forwardedMessages !== undefined && { forwardedMessages: settings.forwardedMessages }),
      ...(settings.readReceipts !== undefined && { readReceipts: settings.readReceipts }),
    };

    await this.db
      .update(users)
      .set({ privacySettings: merged })
      .where(eq(users.id, userId));
  }

  async getPrivacy(userId: string): Promise<PrivacySettingsRow | null> {
    const [row] = await this.db
      .select({ privacySettings: users.privacySettings })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) return null;

    const s = row.privacySettings as Record<string, unknown> | null;
    if (!s) return {};
    return {
      lastSeen: s.lastSeen as number | undefined,
      profilePhoto: s.profilePhoto as number | undefined,
      about: s.about as number | undefined,
      groups: s.groups as number | undefined,
      calls: s.calls as number | undefined,
      forwardedMessages: s.forwardedMessages as number | undefined,
      readReceipts: s.readReceipts as boolean | undefined,
    };
  }

  private async checkOnlineStatus(userId: string): Promise<boolean> {
    const key = `${PRESENCE_KEY_PREFIX}${userId}`;
    const val = await this.redis.get(key);
    return val != null && val !== '';
  }
}
