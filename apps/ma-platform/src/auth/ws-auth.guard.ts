import { Injectable } from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const data = context.switchToWs().getData();

    // Проверка токена для WebSocket соединений
    const token = data?.token || client?.handshake?.auth?.token;

    if (token) {
      // Здесь будет JWT валидация
      return true;
    }

    // Для dev-режима
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    return false;
  }
}
