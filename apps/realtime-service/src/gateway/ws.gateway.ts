import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { StringCodec } from 'nats';
import { NATS_SUBJECTS } from '@aluf/shared';
import { NATS_TOKEN, type NatsClients } from '../providers/nats.provider';
import { ConnectionManager } from './connection-manager';
import { PresenceService } from './presence.service';
import type { WebSocket } from 'ws';
import type { Server } from 'ws';

interface ValidateTokenRequest {
  accessToken: string;
}

interface ValidateTokenResponse {
  valid: boolean;
  userId: string;
  username: string;
  alufId: string;
}

interface AuthServiceGrpc {
  ValidateToken(request: ValidateTokenRequest): Observable<ValidateTokenResponse>;
}

interface MessageSendPayload {
  chatId: string;
  contentType: string;
  textContent: string;
  mediaId?: string;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  selfDestructSeconds?: number;
}

interface MessageReadPayload {
  chatId: string;
  messageId: string;
}

interface TypingPayload {
  chatId: string;
}

interface PresenceUpdatePayload {
  status: string;
}

interface CallSignalPayload {
  callId?: string;
  toUserId?: string;
  targetUserId?: string;
  type: string;
  sdp?: string;
  candidate?: unknown;
  payload?: Record<string, unknown>;
}

const AUTHENTICATED = Symbol('authenticated');
const USER_DATA = Symbol('user_data');

type AuthenticatedSocket = WebSocket & {
  [AUTHENTICATED]?: boolean;
  [USER_DATA]?: ValidateTokenResponse;
};

@WebSocketGateway({ path: '/ws' })
export class WsGatewayHandler implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGatewayHandler.name);
  private authService!: AuthServiceGrpc;
  private readonly sc = StringCodec();
  private readonly pendingAuth = new Map<WebSocket, ReturnType<typeof setTimeout>>();

  constructor(
    @Inject('AUTH_SERVICE_PACKAGE') private readonly authClient: ClientGrpc,
    @Inject(NATS_TOKEN) private readonly nats: NatsClients,
    private readonly connectionManager: ConnectionManager,
    private readonly presenceService: PresenceService,
  ) {}

  onModuleInit() {
    this.authService = this.authClient.getService<AuthServiceGrpc>('AuthService');
  }

  handleConnection(client: AuthenticatedSocket): void {
    const timeout = setTimeout(() => {
      this.pendingAuth.delete(client);
      this.sendToClient(client, 'error', { message: 'Authentication timeout' });
      client.close(4001, 'Authentication timeout');
    }, 10_000);

    this.pendingAuth.set(client, timeout);
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const pending = this.pendingAuth.get(client);
    if (pending) {
      clearTimeout(pending);
      this.pendingAuth.delete(client);
    }

    const userId = this.connectionManager.getUserId(client);
    if (userId) {
      this.connectionManager.removeConnection(userId, client);
      this.presenceService.scheduleOffline(userId);
    }
  }

  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { token: string },
  ): Promise<void> {
    const pending = this.pendingAuth.get(client);
    if (pending) {
      clearTimeout(pending);
      this.pendingAuth.delete(client);
    }

    if (client[AUTHENTICATED]) {
      this.sendToClient(client, 'error', { message: 'Already authenticated' });
      return;
    }

    if (!data?.token) {
      this.sendToClient(client, 'error', { message: 'Token is required' });
      client.close(4002, 'Token required');
      return;
    }

    const AUTH_RETRY_ATTEMPTS = 8;
    const AUTH_RETRY_DELAY_MS = 500;

    try {
      let result: ValidateTokenResponse | null = null;
      let lastErr: unknown = null;

      for (let attempt = 0; attempt < AUTH_RETRY_ATTEMPTS; attempt++) {
        try {
          result = await firstValueFrom(
            this.authService.ValidateToken({ accessToken: data.token }),
          );
          break;
        } catch (err: unknown) {
          lastErr = err;
          const code = (err as { code?: number })?.code;
          if (code === GrpcStatus.UNAVAILABLE && attempt < AUTH_RETRY_ATTEMPTS - 1) {
            await new Promise((r) => setTimeout(r, AUTH_RETRY_DELAY_MS));
            continue;
          }
          throw err;
        }
      }

      if (!result) {
        throw lastErr ?? new Error('Auth service unavailable');
      }

      if (!result.valid) {
        this.sendToClient(client, 'error', { message: 'Invalid token' });
        client.close(4003, 'Invalid token');
        return;
      }

      client[AUTHENTICATED] = true;
      client[USER_DATA] = result;

      this.connectionManager.addConnection(result.userId, client);
      await this.presenceService.setOnline(result.userId);

      this.sendToClient(client, 'authenticated', {
        userId: result.userId,
        username: result.username,
      });
    } catch (err) {
      this.logger.error('Authentication failed', err);
      this.sendToClient(client, 'error', { message: 'Authentication service unavailable' });
      client.close(4004, 'Auth service error');
    }
  }

  @SubscribeMessage('message.send')
  handleMessageSend(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: MessageSendPayload,
  ): void {
    const user = this.requireAuth(client);
    if (!user) return;

    if (!data?.chatId) {
      this.sendToClient(client, 'error', { message: 'chatId is required' });
      return;
    }
    const hasText = typeof data.textContent === 'string' && data.textContent.trim().length > 0;
    const hasMedia = typeof data.mediaId === 'string' && data.mediaId.trim().length > 0;
    if (!hasText && !hasMedia) {
      this.sendToClient(client, 'error', { message: 'textContent or mediaId is required' });
      return;
    }

    this.nats.nc.publish(
      NATS_SUBJECTS.MESSAGE_INCOMING,
      this.sc.encode(JSON.stringify({
        chatId: data.chatId,
        senderId: user.userId,
        contentType: data.contentType || 'text',
        textContent: (data.textContent ?? '').trim(),
        mediaId: data.mediaId || '',
        replyToId: data.replyToId || '',
        metadata: data.metadata || {},
        selfDestructSeconds: data.selfDestructSeconds || 0,
      })),
    );
  }

  @SubscribeMessage('message.read')
  handleMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: MessageReadPayload,
  ): void {
    const user = this.requireAuth(client);
    if (!user) return;

    if (!data?.chatId || !data?.messageId) {
      this.sendToClient(client, 'error', { message: 'chatId and messageId are required' });
      return;
    }

    this.nats.nc.publish(
      NATS_SUBJECTS.MESSAGE_READ,
      this.sc.encode(JSON.stringify({
        chatId: data.chatId,
        messageId: data.messageId,
        userId: user.userId,
        timestamp: new Date().toISOString(),
      })),
    );
  }

  @SubscribeMessage('typing.start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingPayload,
  ): void {
    const user = this.requireAuth(client);
    if (!user) return;

    if (!data?.chatId) return;

    this.nats.nc.publish(
      NATS_SUBJECTS.TYPING,
      this.sc.encode(JSON.stringify({
        chatId: data.chatId,
        userId: user.userId,
        username: user.username,
        action: 'start',
        timestamp: new Date().toISOString(),
      })),
    );
  }

  @SubscribeMessage('typing.stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingPayload,
  ): void {
    const user = this.requireAuth(client);
    if (!user) return;

    if (!data?.chatId) return;

    this.nats.nc.publish(
      NATS_SUBJECTS.TYPING,
      this.sc.encode(JSON.stringify({
        chatId: data.chatId,
        userId: user.userId,
        username: user.username,
        action: 'stop',
        timestamp: new Date().toISOString(),
      })),
    );
  }

  @SubscribeMessage('presence.update')
  async handlePresenceUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: PresenceUpdatePayload,
  ): Promise<void> {
    const user = this.requireAuth(client);
    if (!user) return;

    if (data?.status === 'online') {
      await this.presenceService.heartbeat(user.userId);
    }
  }

  @SubscribeMessage('call.signal')
  handleCallSignal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: CallSignalPayload,
  ): void {
    const user = this.requireAuth(client);
    if (!user) return;

    if (!data?.type) {
      this.sendToClient(client, 'error', { message: 'Signal type is required' });
      return;
    }

    if (!data?.callId) {
      this.sendToClient(client, 'error', { message: 'callId is required' });
      return;
    }

    // Для WebRTC сигналов указываем целевого пользователя
    const toUserId = data.toUserId ?? data.targetUserId;
    this.nats.nc.publish(
      NATS_SUBJECTS.CALL_SIGNAL,
      this.sc.encode(JSON.stringify({
        callId: data.callId,
        fromUserId: user.userId,
        toUserId,
        type: data.type,
        payload: data.payload ?? data.sdp ?? data.candidate,
        timestamp: new Date().toISOString(),
      })),
    );
  }

  private requireAuth(client: AuthenticatedSocket): ValidateTokenResponse | null {
    if (!client[AUTHENTICATED] || !client[USER_DATA]) {
      this.sendToClient(client, 'error', { message: 'Not authenticated' });
      return null;
    }
    return client[USER_DATA]!;
  }

  private sendToClient(client: WebSocket, event: string, data: unknown): void {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }
}
