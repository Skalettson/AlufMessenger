import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { InitiateCallDto, CallSignalDto } from '../dto/call.dto';

interface ChatServiceGrpcMini {
  GetChat(req: { chatId: string; userId: string }): Observable<unknown>;
}

interface UserServiceGrpcMini {
  GetUser(req: { userId: string }): Observable<unknown>;
}

interface CallServiceGrpc {
  InitiateCall(req: Record<string, unknown>): Observable<unknown>;
  JoinCall(req: { callId: string; userId: string }): Observable<unknown>;
  LeaveCall(req: { callId: string; userId: string }): Observable<unknown>;
  EndCall(req: { callId: string; userId: string }): Observable<unknown>;
  GetCall(req: { callId: string; userId: string }): Observable<unknown>;
  GetCallToken(req: { callId: string; userId: string; username: string; displayName?: string }): Observable<unknown>;
  Signal(req: { callId: string; fromUserId: string; toUserId: string; signalType: string; payload: string }): Observable<unknown>;
  BroadcastSignal(req: { callId: string; fromUserId: string; signalType: string; payload: string }): Observable<unknown>;
}

@Controller('v1/calls')
export class CallRoutesController implements OnModuleInit {
  private callService!: CallServiceGrpc;
  private chatService!: ChatServiceGrpcMini;
  private userService!: UserServiceGrpcMini;

  constructor(
    @Inject('CALL_SERVICE_PACKAGE') private readonly callClient: ClientGrpc,
    @Inject('CHAT_SERVICE_PACKAGE') private readonly chatClient: ClientGrpc,
    @Inject('USER_SERVICE_PACKAGE') private readonly userClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.callService = this.callClient.getService<CallServiceGrpc>('CallService');
    this.chatService = this.chatClient.getService<ChatServiceGrpcMini>('ChatService');
    this.userService = this.userClient.getService<UserServiceGrpcMini>('UserService');
  }

  @Post()
  async initiateCall(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(InitiateCallDto)) body: InitiateCallDto) {
    const typeMap: Record<string, number> = { voice: 1, video: 2 };
    const raw = String(body.type ?? '').toLowerCase();
    const callTypeNum =
      raw === 'voice' || raw === 'call_type_voice'
        ? 1
        : raw === 'video' || raw === 'call_type_video'
          ? 2
          : typeof body.type === 'number' && (body.type === 1 || body.type === 2)
            ? body.type
            : typeMap[raw] ?? 1;

    const chat = (await firstValueFrom(
      this.chatService.GetChat({ chatId: body.chatId, userId: user.userId }),
    )) as Record<string, unknown>;

    const chatTypeRaw = chat?.type ?? chat?.chatType;
    let isGroup = false;
    if (typeof chatTypeRaw === 'number') {
      isGroup = chatTypeRaw === 2 || chatTypeRaw === 3 || chatTypeRaw === 4;
    } else {
      const s = String(chatTypeRaw ?? '').toUpperCase();
      isGroup =
        s.includes('GROUP') ||
        s.includes('CHANNEL') ||
        s.includes('SUPERGROUP') ||
        s === 'CHAT_TYPE_GROUP' ||
        s === 'CHAT_TYPE_CHANNEL' ||
        s === 'CHAT_TYPE_SUPERGROUP';
    }

    return firstValueFrom(
      this.callService.InitiateCall({
        chatId: body.chatId,
        callerId: user.userId,
        type: callTypeNum,
        isGroup,
      }),
    );
  }

  @Post(':id/join')
  joinCall(@CurrentUser() user: RequestUser, @Param('id') callId: string) {
    return firstValueFrom(
      this.callService.JoinCall({ callId, userId: user.userId }),
    );
  }

  @Post(':id/leave')
  leaveCall(@CurrentUser() user: RequestUser, @Param('id') callId: string) {
    return firstValueFrom(
      this.callService.LeaveCall({ callId, userId: user.userId }),
    );
  }

  @Post(':id/end')
  endCall(@CurrentUser() user: RequestUser, @Param('id') callId: string) {
    return firstValueFrom(
      this.callService.EndCall({ callId, userId: user.userId }),
    );
  }

  @Get(':id')
  getCall(@CurrentUser() user: RequestUser, @Param('id') callId: string) {
    return firstValueFrom(
      this.callService.GetCall({ callId, userId: user.userId }),
    );
  }

  @Post(':id/token')
  async getCallToken(@CurrentUser() user: RequestUser, @Param('id') callId: string) {
    let username = '';
    let displayName = '';
    try {
      const profile = (await firstValueFrom(
        this.userService.GetUser({ userId: user.userId }),
      )) as Record<string, unknown>;
      username = String(profile?.username ?? '').trim();
      displayName = String(profile?.displayName ?? profile?.display_name ?? '').trim();
    } catch {
      // профиль недоступен — ниже подставим userId как fallback для identity
    }

    return firstValueFrom(
      this.callService.GetCallToken({
        callId,
        userId: user.userId,
        username: username || user.userId,
        displayName: displayName || undefined,
      }),
    );
  }

  @Post(':id/signal')
  async sendSignal(
    @CurrentUser() user: RequestUser,
    @Param('id') callId: string,
    @Body(new ZodValidationPipe(CallSignalDto)) body: CallSignalDto,
  ) {
    return firstValueFrom(
      this.callService.Signal({
        callId,
        fromUserId: user.userId,
        toUserId: body.toUserId,
        signalType: body.signalType,
        payload: JSON.stringify(body.payload),
      }),
    );
  }

  @Post(':id/broadcast')
  async broadcastSignal(
    @CurrentUser() user: RequestUser,
    @Param('id') callId: string,
    @Body() body: { signalType: string; payload: Record<string, unknown> },
  ) {
    return firstValueFrom(
      this.callService.BroadcastSignal({
        callId,
        fromUserId: user.userId,
        signalType: body.signalType,
        payload: JSON.stringify(body.payload),
      }),
    );
  }
}
