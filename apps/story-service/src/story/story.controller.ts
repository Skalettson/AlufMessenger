import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  AlufError,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '@aluf/shared';
import type { StoryPrivacySettings } from '@aluf/shared';
import { StoryService } from './story.service';

const STORY_PRIVACY_EVERYONE = 1;
const STORY_PRIVACY_CONTACTS = 2;
const STORY_PRIVACY_SELECTED = 3;
const STORY_PRIVACY_EXCEPT = 4;

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError) code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof NotFoundError) code = GrpcStatus.NOT_FOUND;
    else if (err instanceof ForbiddenError) code = GrpcStatus.PERMISSION_DENIED;
    return new RpcException({ code, message: err.message });
  }
  return new RpcException({
    code: GrpcStatus.INTERNAL,
    message: err instanceof Error ? err.message : 'Internal server error',
  });
}

function toGrpcTimestamp(date: Date): { seconds: number; nanos: number } {
  const ms = date.getTime();
  return { seconds: Math.floor(ms / 1000), nanos: (ms % 1000) * 1_000_000 };
}

function privacyToProto(privacy: StoryPrivacySettings | null | undefined): number {
  if (!privacy?.level || privacy.level === 'everyone') return STORY_PRIVACY_EVERYONE;
  if (privacy.level === 'contacts') return STORY_PRIVACY_CONTACTS;
  if (privacy.level === 'selected') return STORY_PRIVACY_SELECTED;
  if (privacy.level === 'except') return STORY_PRIVACY_EXCEPT;
  return STORY_PRIVACY_EVERYONE;
}

function protoToPrivacy(privacyEnum: number, allowedIds: string[], excludedIds: string[]): StoryPrivacySettings {
  if (privacyEnum === STORY_PRIVACY_CONTACTS) return { level: 'contacts' };
  if (privacyEnum === STORY_PRIVACY_SELECTED) return { level: 'selected', allowedUserIds: allowedIds };
  if (privacyEnum === STORY_PRIVACY_EXCEPT) return { level: 'except', excludedUserIds: excludedIds };
  return { level: 'everyone' };
}

function toStoryResponse(story: {
  id: string;
  userId: string;
  mediaId: string;
  caption: string | null;
  privacy: unknown;
  viewCount: number;
  expiresAt: Date;
  createdAt: Date;
  viewed?: boolean;
}) {
  const privacy = story.privacy as StoryPrivacySettings | undefined;
  return {
    id: story.id,
    userId: story.userId,
    mediaId: story.mediaId,
    mediaUrl: '',
    caption: story.caption ?? '',
    privacy: privacyToProto(privacy),
    allowedUserIds: privacy?.level === 'selected' ? (privacy.allowedUserIds ?? []) : [],
    excludedUserIds: privacy?.level === 'except' ? (privacy.excludedUserIds ?? []) : [],
    viewCount: story.viewCount,
    reactionCount: 0,
    createdAt: toGrpcTimestamp(story.createdAt),
    expiresAt: toGrpcTimestamp(story.expiresAt),
    viewed: story.viewed ?? false,
  };
}

@Controller()
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @GrpcMethod('StoryService', 'CreateStory')
  async createStory(data: {
    user_id?: string;
    userId?: string;
    media_id?: string;
    mediaId?: string;
    caption?: string;
    privacy?: number;
    allowed_user_ids?: string[];
    excluded_user_ids?: string[];
    ttl_hours?: number;
  }) {
    try {
      const userId = (data.user_id ?? data.userId ?? '').trim();
      const mediaId = (data.media_id ?? data.mediaId ?? '').trim();
      if (!userId || !mediaId) throw new BadRequestError('user_id и media_id обязательны');
      const ttlHours = data.ttl_hours ?? 24;
      const privacy = protoToPrivacy(
        data.privacy ?? STORY_PRIVACY_EVERYONE,
        data.allowed_user_ids ?? [],
        data.excluded_user_ids ?? [],
      );
      const story = await this.storyService.createStory(
        userId,
        mediaId,
        data.caption || undefined,
        privacy,
        ttlHours,
      );
      return toStoryResponse(story);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StoryService', 'GetStories')
  async getStories(data: { user_id?: string; userId?: string }) {
    try {
      const viewerId = (data.user_id ?? data.userId ?? '').trim();
      if (!viewerId) throw new BadRequestError('user_id обязателен');
      const groups = await this.storyService.getStoriesFeed(viewerId);
      return {
        storyGroups: groups.map((g) => ({
          userId: g.userId,
          username: g.username,
          displayName: g.displayName,
          avatarUrl: g.avatarUrl ?? '',
          stories: g.stories.map(toStoryResponse),
          hasUnseen: g.hasUnseen,
          latestStoryAt: toGrpcTimestamp(g.latestStoryAt),
        })),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StoryService', 'GetUserStories')
  async getUserStories(data: { target_user_id?: string; targetUserId?: string; viewer_id?: string; viewerId?: string }) {
    try {
      const targetUserId = (data.target_user_id ?? data.targetUserId ?? '').trim();
      const viewerId = (data.viewer_id ?? data.viewerId ?? '').trim();
      if (!targetUserId || !viewerId) throw new BadRequestError('target_user_id и viewer_id обязательны');
      const group = await this.storyService.getUserStoriesGroup(viewerId, targetUserId);
      if (!group) {
        return { userId: targetUserId, username: '', displayName: '', avatarUrl: '', stories: [], hasUnseen: false, latestStoryAt: toGrpcTimestamp(new Date(0)) };
      }
      return {
        userId: group.userId,
        username: group.username,
        displayName: group.displayName,
        avatarUrl: group.avatarUrl ?? '',
        stories: group.stories.map(toStoryResponse),
        hasUnseen: group.hasUnseen,
        latestStoryAt: toGrpcTimestamp(group.latestStoryAt),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StoryService', 'ViewStory')
  async viewStory(data: { story_id?: string; storyId?: string; viewer_id?: string; viewerId?: string }) {
    try {
      const storyId = (data.story_id ?? data.storyId ?? '').trim();
      const viewerId = (data.viewer_id ?? data.viewerId ?? '').trim();
      if (!storyId || !viewerId) throw new BadRequestError('story_id и viewer_id обязательны');
      await this.storyService.viewStory(storyId, viewerId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StoryService', 'GetStoryViewsList')
  async getStoryViewsList(data: { story_id?: string; storyId?: string; owner_id?: string; ownerId?: string }) {
    try {
      const storyId = (data.story_id ?? data.storyId ?? '').trim();
      const ownerId = (data.owner_id ?? data.ownerId ?? '').trim();
      if (!storyId || !ownerId) throw new BadRequestError('story_id и owner_id обязательны');
      const viewers = await this.storyService.getStoryViewsList(storyId, ownerId);
      return {
        viewers: viewers.map((v) => ({
          userId: v.userId,
          username: v.username,
          displayName: v.displayName,
          avatarUrl: v.avatarUrl ?? '',
          viewedAt: toGrpcTimestamp(v.viewedAt),
          reactionEmoji: v.reactionEmoji,
        })),
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StoryService', 'GetStoryOwner')
  async getStoryOwner(data: { story_id?: string; storyId?: string }) {
    try {
      const storyId = (data.story_id ?? data.storyId ?? '').trim();
      if (!storyId) throw new BadRequestError('story_id обязателен');
      const r = await this.storyService.getStoryOwner(storyId);
      return {
        owner_user_id: r.ownerUserId,
        ownerUserId: r.ownerUserId,
        media_id: r.mediaId,
        mediaId: r.mediaId,
        caption: r.caption ?? '',
        owner_display_name: r.ownerDisplayName,
        ownerDisplayName: r.ownerDisplayName,
      };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StoryService', 'ReactToStory')
  async reactToStory(data: { story_id?: string; storyId?: string; user_id?: string; userId?: string; emoji?: string }) {
    try {
      const storyId = (data.story_id ?? data.storyId ?? '').trim();
      const userId = (data.user_id ?? data.userId ?? '').trim();
      const emoji = (data.emoji ?? '').trim();
      if (!storyId || !userId || !emoji) throw new BadRequestError('story_id, user_id и emoji обязательны');
      await this.storyService.reactToStory(storyId, userId, emoji);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('StoryService', 'DeleteStory')
  async deleteStory(data: { story_id?: string; storyId?: string; user_id?: string; userId?: string }) {
    try {
      const storyId = (data.story_id ?? data.storyId ?? '').trim();
      const userId = (data.user_id ?? data.userId ?? '').trim();
      if (!storyId || !userId) throw new BadRequestError('story_id и user_id обязательны');
      await this.storyService.deleteStory(storyId, userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
