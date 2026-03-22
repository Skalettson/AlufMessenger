import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Простая проверка авторизации
    // В реальной реализации будет JWT валидация
    const appId = request.headers['x-aluf-app-id'];
    const userId = request.headers['x-aluf-user-id'];

    if (appId && userId) {
      request.user = {
        appId,
        userId,
      };
      return true;
    }

    // Для dev-режима разрешаем без авторизации
    if (process.env.NODE_ENV === 'development') {
      request.user = {
        appId: appId || 'dev-app',
        userId: userId || 'dev-user',
      };
      return true;
    }

    this.logger.warn('Unauthorized request');
    return false;
  }
}
