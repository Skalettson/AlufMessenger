import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  CreateChatDto,
  UpdateChatDto,
  AddMembersDto,
  UpdateMemberRoleDto,
  CreateInviteLinkDto,
  BanMemberDto,
  UnbanMemberDto,
  GetBannedMembersDto,
  GetAuditLogDto,
  ModerationSettingsDto,
  CreateTopicDto,
  UpdateTopicDto,
  ToggleTopicDto,
  GetTopicsDto,
} from '../dto/chat.dto';

interface CreateChatGrpcRequest {
  type: number;
  name: string;
  description: string;
  avatarUrl: string;
  creatorId: string;
  memberIds: string[];
  username?: string;
}

interface ChatServiceGrpc {
  GetUserChats(req: { userId: string; cursor?: string; limit?: number }): Observable<unknown>;
  CreateChat(req: CreateChatGrpcRequest): Observable<unknown>;
  GetChat(req: { chatId: string; userId: string }): Observable<unknown>;
  GetChannelByUsername(req: { username: string }): Observable<unknown>;
  UpdateChat(req: UpdateChatDto & { chatId: string; userId: string }): Observable<unknown>;
  DeleteChat(req: { chatId: string; userId: string }): Observable<unknown>;
  GetMembers(req: { chatId: string; limit?: number; offset?: number; viewerUserId?: string }): Observable<unknown>;
  AddMembers(req: { chatId: string; addedBy: string; userIds: string[] }): Observable<unknown>;
  RemoveMember(req: { chatId: string; requesterId: string; userId: string }): Observable<unknown>;
  UpdateMemberRole(req: { chatId: string; requesterId: string; userId: string; role: string }): Observable<unknown>;
  JoinChat(req: { chatId: string; userId: string; invite_link?: string; inviteLink?: string }): Observable<unknown>;
  LeaveChat(req: { chatId: string; userId: string }): Observable<unknown>;
  PinChat(req: { chatId: string; userId: string }): Observable<unknown>;
  UnpinChat(req: { chatId: string; userId: string }): Observable<unknown>;
  CreateInviteLink(req: CreateInviteLinkDto & { chatId: string; userId: string; createdBy?: string }): Observable<unknown>;
  GetChatByInviteLink(req: {
    code?: string;
    invite_link?: string;
    inviteLink?: string;
  }): Observable<unknown>;
  
  // Новые методы для расширенных функций групп
  BanMember(req: { chatId: string; bannedBy: string; userId: string; reason?: string; expiresAt?: { seconds: number; nanos: number }; deleteMessages: boolean }): Observable<unknown>;
  UnbanMember(req: { chatId: string; unbannedBy: string; userId: string }): Observable<unknown>;
  GetBannedMembers(req: { chatId: string; limit: number; offset: number }): Observable<unknown>;
  GetAuditLog(req: { chatId: string; limit: number; offset: number; actionFilter?: string }): Observable<unknown>;
  UpdateModerationSettings(req: { chatId: string; updatedBy: string; settings: Record<string, unknown> }): Observable<unknown>;
  GetModerationSettings(req: { chatId: string }): Observable<unknown>;
  
  // Методы для тем/топиков
  CreateTopic(req: { chatId: string; createdBy: string; title: string; icon?: string; color?: number }): Observable<unknown>;
  UpdateTopic(req: { chatId: string; topicId: string; updatedBy: string; title?: string; icon?: string; color?: number }): Observable<unknown>;
  DeleteTopic(req: { chatId: string; topicId: string; deletedBy: string }): Observable<unknown>;
  GetTopics(req: { chatId: string; limit: number; offset: number }): Observable<unknown>;
  ToggleTopic(req: { chatId: string; topicId: string; toggledBy: string; isClosed: boolean }): Observable<unknown>;
}

@Controller('v1/chats')
export class ChatRoutesController implements OnModuleInit {
  private chatService!: ChatServiceGrpc;

  constructor(
    @Inject('CHAT_SERVICE_PACKAGE') private readonly chatClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.chatService = this.chatClient.getService<ChatServiceGrpc>('ChatService');
  }

  @Get()
  getUserChats(
    @CurrentUser() user: RequestUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return firstValueFrom(
      this.chatService.GetUserChats({
        userId: user.userId,
        cursor,
        limit: limit ? parseInt(limit, 10) : undefined,
      }),
    );
  }

  @Post()
  createChat(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateChatDto)) body: CreateChatDto,
  ) {
    const typeMap: Record<string, number> = {
      private: 1,
      group: 2,
      channel: 3,
      supergroup: 4,
    };
    const typeNum = typeMap[body.type] ?? 1;
    return firstValueFrom(
      this.chatService.CreateChat({
        type: typeNum,
        name: body.title ?? '',
        description: body.description ?? '',
        avatarUrl: '',
        creatorId: user.userId,
        memberIds: body.memberIds ?? [],
        username: (body.type === 'channel' || body.type === 'supergroup' || body.type === 'group') ? (body.username ?? '') : undefined,
      }),
    );
  }

  @Get('by-username/:username')
  getChannelByUsername(@Param('username') username: string) {
    return firstValueFrom(
      this.chatService.GetChannelByUsername({ username: username?.trim().replace(/^@/, '') || '' }),
    );
  }

  @Get(':id')
  getChat(@CurrentUser() user: RequestUser, @Param('id') chatId: string) {
    return firstValueFrom(
      this.chatService.GetChat({ chatId, userId: user.userId }),
    );
  }

  @Patch(':id')
  updateChat(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Body(new ZodValidationPipe(UpdateChatDto)) body: UpdateChatDto,
  ) {
    const avatarFileId = (body as { avatarFileId?: string }).avatarFileId?.trim();
    const avatarUrl = avatarFileId ? avatarFileId : undefined;
    const req: Record<string, unknown> = {
      chatId,
      userId: user.userId,
    };
    if (body.title !== undefined) req.name = body.title;
    if (body.description !== undefined) req.description = body.description;
    if (body.username !== undefined) req.username = body.username;
    if (body.slowModeSeconds !== undefined) req.slowModeSeconds = body.slowModeSeconds;
    if (avatarUrl !== undefined) req.avatarUrl = avatarUrl;
    return firstValueFrom(this.chatService.UpdateChat(req as Parameters<ChatServiceGrpc['UpdateChat']>[0]));
  }

  @Delete(':id')
  deleteChat(@CurrentUser() user: RequestUser, @Param('id') chatId: string) {
    return firstValueFrom(
      this.chatService.DeleteChat({ chatId, userId: user.userId }),
    );
  }

  @Get(':id/members')
  getMembers(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return firstValueFrom(
      this.chatService.GetMembers({
        chatId,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        viewerUserId: user.userId,
      }),
    );
  }

  @Post(':id/members')
  addMembers(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Body(new ZodValidationPipe(AddMembersDto)) body: AddMembersDto,
  ) {
    return firstValueFrom(
      this.chatService.AddMembers({ chatId, addedBy: user.userId, userIds: body.userIds }),
    );
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Param('userId') targetUserId: string,
  ) {
    return firstValueFrom(
      this.chatService.RemoveMember({ chatId, requesterId: user.userId, userId: targetUserId }),
    );
  }

  @Patch(':id/members/:userId/role')
  updateMemberRole(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Param('userId') targetUserId: string,
    @Body(new ZodValidationPipe(UpdateMemberRoleDto)) body: UpdateMemberRoleDto,
  ) {
    return firstValueFrom(
      this.chatService.UpdateMemberRole({
        chatId,
        requesterId: user.userId,
        userId: targetUserId,
        role: body.role,
      }),
    );
  }

  @Post(':id/join')
  joinChat(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Body() body: { inviteLink?: string; invite_link?: string },
  ) {
    const inviteLink = body?.inviteLink ?? body?.invite_link ?? '';
    return firstValueFrom(
      this.chatService.JoinChat({ chatId, userId: user.userId, invite_link: inviteLink, inviteLink }),
    );
  }

  @Post(':id/leave')
  leaveChat(@CurrentUser() user: RequestUser, @Param('id') chatId: string) {
    return firstValueFrom(
      this.chatService.LeaveChat({ chatId, userId: user.userId }),
    );
  }

  @Post(':id/pin')
  pinChat(@CurrentUser() user: RequestUser, @Param('id') chatId: string) {
    return firstValueFrom(
      this.chatService.PinChat({ chatId, userId: user.userId }),
    );
  }

  @Delete(':id/pin')
  unpinChat(@CurrentUser() user: RequestUser, @Param('id') chatId: string) {
    return firstValueFrom(
      this.chatService.UnpinChat({ chatId, userId: user.userId }),
    );
  }

  @Post(':id/invite-link')
  createInviteLink(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Body(new ZodValidationPipe(CreateInviteLinkDto)) body: CreateInviteLinkDto,
  ) {
    return firstValueFrom(
      this.chatService.CreateInviteLink({
        ...body,
        chatId,
        userId: user.userId,
        createdBy: user.userId,
      }),
    );
  }

  @Get('join/:code')
  getChatByInviteLink(@Param('code') code: string) {
    const c = (code ?? '').trim();
    /** proto: GetChatByInviteLinkRequest.invite_link — без этого поля gRPC уходит с пустым кодом */
    return firstValueFrom(
      this.chatService.GetChatByInviteLink({
        code: c,
        invite_link: c,
        inviteLink: c,
      }),
    );
  }

  // === Новые routes для расширенных функций групп ===

  @Post(':id/ban')
  banMember(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Body(new ZodValidationPipe(BanMemberDto)) body: BanMemberDto,
  ) {
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    return firstValueFrom(
      this.chatService.BanMember({
        chatId,
        bannedBy: user.userId,
        userId: body.userId,
        reason: body.reason,
        expiresAt: expiresAt ? { seconds: Math.floor(expiresAt.getTime() / 1000), nanos: 0 } : undefined,
        deleteMessages: body.deleteMessages ?? false,
      }),
    );
  }

  @Post(':id/unban')
  unbanMember(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Body(new ZodValidationPipe(UnbanMemberDto)) body: UnbanMemberDto,
  ) {
    return firstValueFrom(
      this.chatService.UnbanMember({
        chatId,
        unbannedBy: user.userId,
        userId: body.userId,
      }),
    );
  }

  @Get(':id/banned')
  getBannedMembers(
    @Param('id') chatId: string,
    @Query(new ZodValidationPipe(GetBannedMembersDto)) query: GetBannedMembersDto,
  ) {
    return firstValueFrom(
      this.chatService.GetBannedMembers({
        chatId,
        limit: query.limit,
        offset: query.offset,
      }),
    );
  }

  @Get(':id/audit-log')
  getAuditLog(
    @Param('id') chatId: string,
    @Query(new ZodValidationPipe(GetAuditLogDto)) query: GetAuditLogDto,
  ) {
    return firstValueFrom(
      this.chatService.GetAuditLog({
        chatId,
        limit: query.limit,
        offset: query.offset,
        actionFilter: query.actionFilter,
      }),
    );
  }

  @Get(':id/moderation-settings')
  getModerationSettings(@Param('id') chatId: string) {
    return firstValueFrom(
      this.chatService.GetModerationSettings({ chatId }),
    );
  }

  @Patch(':id/moderation-settings')
  updateModerationSettings(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Body(new ZodValidationPipe(ModerationSettingsDto)) body: ModerationSettingsDto,
  ) {
    return firstValueFrom(
      this.chatService.UpdateModerationSettings({
        chatId,
        updatedBy: user.userId,
        settings: body as Record<string, unknown>,
      }),
    );
  }

  // === Методы для тем/топиков ===

  @Post(':id/topics')
  createTopic(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Body(new ZodValidationPipe(CreateTopicDto)) body: CreateTopicDto,
  ) {
    return firstValueFrom(
      this.chatService.CreateTopic({
        chatId,
        createdBy: user.userId,
        title: body.title,
        icon: body.icon,
        color: body.color,
      }),
    );
  }

  @Get(':id/topics')
  getTopics(
    @Param('id') chatId: string,
    @Query(new ZodValidationPipe(GetTopicsDto)) query: GetTopicsDto,
  ) {
    return firstValueFrom(
      this.chatService.GetTopics({
        chatId,
        limit: query.limit,
        offset: query.offset,
      }),
    );
  }

  @Patch(':id/topics/:topicId')
  updateTopic(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Param('topicId') topicId: string,
    @Body(new ZodValidationPipe(UpdateTopicDto)) body: UpdateTopicDto,
  ) {
    return firstValueFrom(
      this.chatService.UpdateTopic({
        chatId,
        topicId,
        updatedBy: user.userId,
        title: body.title,
        icon: body.icon,
        color: body.color,
      }),
    );
  }

  @Delete(':id/topics/:topicId')
  deleteTopic(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Param('topicId') topicId: string,
  ) {
    return firstValueFrom(
      this.chatService.DeleteTopic({
        chatId,
        topicId,
        deletedBy: user.userId,
      }),
    );
  }

  @Patch(':id/topics/:topicId/toggle')
  toggleTopic(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Param('topicId') topicId: string,
    @Body(new ZodValidationPipe(ToggleTopicDto)) body: ToggleTopicDto,
  ) {
    return firstValueFrom(
      this.chatService.ToggleTopic({
        chatId,
        topicId,
        toggledBy: user.userId,
        isClosed: body.isClosed,
      }),
    );
  }

  @Post(':id/mute')
  muteChat(
    @CurrentUser() user: RequestUser,
    @Param('id') chatId: string,
    @Body() body: { mutedUntil?: string },
  ) {
    return firstValueFrom(
      (this.chatService as any).MuteChat({
        chatId,
        userId: user.userId,
        mutedUntil: body.mutedUntil ? { seconds: Math.floor(new Date(body.mutedUntil).getTime() / 1000), nanos: 0 } : undefined,
      }),
    );
  }

  @Delete(':id/mute')
  unmuteChat(@CurrentUser() user: RequestUser, @Param('id') chatId: string) {
    return firstValueFrom(
      (this.chatService as any).UnmuteChat({ chatId, userId: user.userId }),
    );
  }

  @Post(':id/archive')
  archiveChat(@CurrentUser() user: RequestUser, @Param('id') chatId: string) {
    return firstValueFrom(
      (this.chatService as any).ArchiveChat({ chatId, userId: user.userId }),
    );
  }

  @Delete(':id/archive')
  unarchiveChat(@CurrentUser() user: RequestUser, @Param('id') chatId: string) {
    return firstValueFrom(
      (this.chatService as any).UnarchiveChat({ chatId, userId: user.userId }),
    );
  }
}
