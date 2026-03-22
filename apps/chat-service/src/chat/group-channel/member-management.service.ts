import { Injectable } from '@nestjs/common';
import { BadRequestError } from '@aluf/shared';
import { MemberManagementRepository } from './member-management.repository';

@Injectable()
export class MemberManagementService {
  constructor(private readonly repository: MemberManagementRepository) {}

  async addMembers(chatId: string, requesterId: string, memberIds: string[]) {
    if (!chatId) throw new BadRequestError('chatId is required');
    if (!requesterId) throw new BadRequestError('requesterId is required');
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      throw new BadRequestError('memberIds is required');
    }
    await this.repository.addMembers(chatId, memberIds);
  }

  async removeMember(chatId: string, requesterId: string, memberId: string) {
    if (!chatId || !requesterId || !memberId) throw new BadRequestError('Invalid request');
    await this.repository.removeMember(chatId, memberId);
  }

  async updateRole(chatId: string, requesterId: string, memberId: string, role: 'member' | 'admin' | 'owner') {
    if (!chatId || !requesterId || !memberId) throw new BadRequestError('Invalid request');
    if (!['member', 'admin', 'owner'].includes(role)) throw new BadRequestError('Invalid role');
    await this.repository.updateRole(chatId, memberId, role);
  }
}
