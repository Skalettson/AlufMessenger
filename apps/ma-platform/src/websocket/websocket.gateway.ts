import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server } from 'ws';
import { WebSocket } from 'ws';

interface WebSocketClient extends WebSocket {
  id: string;
  appId?: string;
  userId?: string;
  isAlive: boolean;
}

@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: '*',
  },
})
export class MaPlatformGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MaPlatformGateway.name);
  private readonly clients = new Map<string, WebSocketClient>();

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
    this.startPingInterval();
  }

  handleConnection(client: WebSocketClient) {
    client.id = this.generateId();
    client.isAlive = true;
    this.clients.set(client.id, client);

    this.logger.debug(`Client connected: ${client.id}`);

    client.send(
      JSON.stringify({
        type: 'connected',
        clientId: client.id,
        timestamp: Date.now(),
      }),
    );
  }

  handleDisconnect(client: WebSocketClient) {
    this.clients.delete(client.id);
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: WebSocketClient,
  ) {
    const message = data as { type: string; payload?: unknown };

    this.logger.debug(`Message from ${client.id}: ${message.type}`);

    switch (message.type) {
      case 'init':
        this.handleInit(client, message.payload);
        break;
      case 'request':
        this.handleRequest(client, message.payload);
        break;
      case 'event':
        this.handleEvent(client, message.payload);
        break;
      default:
        this.logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  private handleInit(client: WebSocketClient, payload: unknown) {
    const initData = payload as { appId?: string; userId?: string };
    client.appId = initData.appId;
    client.userId = initData.userId;

    this.logger.debug(`Client ${client.id} initialized: app=${client.appId}`);

    client.send(
      JSON.stringify({
        type: 'init:ok',
        platform: {
          type: 'aluf-messenger',
          version: '1.0.0',
        },
      }),
    );
  }

  private handleRequest(client: WebSocketClient, payload: unknown) {
    const request = payload as {
      id: string;
      method: string;
      params?: unknown;
    };

    this.logger.debug(`Request ${request.id}: ${request.method}`);

    client.send(
      JSON.stringify({
        type: 'response',
        id: request.id,
        result: { success: true },
        timestamp: Date.now(),
      }),
    );
  }

  private handleEvent(client: WebSocketClient, payload: unknown) {
    const event = payload as { type: string; data?: unknown };
    this.logger.debug(`Event from ${client.id}: ${event.type}`);
  }

  sendToClient(clientId: string, message: unknown) {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  sendToApp(appId: string, message: unknown) {
    this.clients.forEach((client) => {
      if (client.appId === appId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  broadcast(message: unknown) {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  sendBotEvent(userId: string, event: { type: string; data: unknown }) {
    this.clients.forEach((client) => {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            ...event,
            type: 'bot:event',
          }),
        );
      }
    });
  }

  private generateId(): string {
    return `ws_${uuidv4()}`;
  }

  private startPingInterval() {
    setInterval(() => {
      this.clients.forEach((client) => {
        if (!client.isAlive) {
          this.clients.delete(client.id);
          client.terminate();
          return;
        }

        client.isAlive = false;
        client.ping();
      });
    }, 30000);
  }
}

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
