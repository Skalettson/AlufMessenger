import { Injectable } from '@nestjs/common';
import { BadRequestError, CHAT_TITLE_MAX_LENGTH, CHAT_USERNAME_MAX_LENGTH, CHAT_USERNAME_MIN_LENGTH, CHAT_USERNAME_REGEX } from '@aluf/shared';
import { GroupChannelRepository } from './group-channel.repository';
import type { CreateGroupChannelInput, GroupChannelPermissions } from './domain';

const OWNER_PERMISSIONS: GroupChannelPermissions = {
  canDeleteMessages: true,
  canBanMembers: true,
  canPinMessages: true,
  canEditInfo: true,
  canInviteMembers: true,
  canManageVoiceChats: true,
  canPostMessages: true,
  canEditMessages: true,
  canRestrictMembers: true,
  canPostMedia: true,
  canSendPolls: true,
  canSendStickers: true,
  canManageTopics: true,
  canViewAuditLog: true,
  canDeleteMessagesOfOthers: true,
};

@Injectable()
export class GroupChannelService {
  constructor(private readonly repository: GroupChannelRepository) {}

  async create(input: CreateGroupChannelInput) {
    const title = (input.title ?? '').trim();
    if (!title) throw new BadRequestError('Title is required');
    if (title.length > CHAT_TITLE_MAX_LENGTH) {
      throw new BadRequestError(`Title must be <= ${CHAT_TITLE_MAX_LENGTH} chars`);
    }

    const username = (input.username ?? '').trim().replace(/^@/, '').toLowerCase();
    if (username) {
      if (username.length < CHAT_USERNAME_MIN_LENGTH || username.length > CHAT_USERNAME_MAX_LENGTH) {
        throw new BadRequestError(
          `Username length must be ${CHAT_USERNAME_MIN_LENGTH}-${CHAT_USERNAME_MAX_LENGTH}`,
        );
      }
      if (!CHAT_USERNAME_REGEX.test(username)) {
        throw new BadRequestError('Invalid username format');
      }
    }

    return this.repository.create(
      {
        ...input,
        title,
        username: username || undefined,
      },
      OWNER_PERMISSIONS,
    );
  }

  async mute(chatId: string, userId: string, until?: Date) {
    await this.repository.setMuted(chatId, userId, until ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
  }

  async unmute(chatId: string, userId: string) {
    await this.repository.setMuted(chatId, userId, null);
  }

  async archive(chatId: string, userId: string) {
    await this.repository.setArchived(chatId, userId, true);
  }

  async unarchive(chatId: string, userId: string) {
    await this.repository.setArchived(chatId, userId, false);
  }
}
