import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import type { ClientGrpc } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { RequestUser } from '../decorators/public.decorator';
import { ADMIN_USERNAME } from '@aluf/shared';

interface UserServiceGrpc {
  GetUser(req: { userId: string }): import('rxjs').Observable<{ username?: string }>;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject('USER_SERVICE_PACKAGE') private readonly userClient: ClientGrpc,
  ) {}

  private getUserService(): UserServiceGrpc {
    return this.userClient.getService<UserServiceGrpc>('UserService');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: RequestUser }>();
    const user = request.user;
    if (!user?.userId) {
      throw new ForbiddenException('Требуется авторизация');
    }
    const profile = await firstValueFrom(
      this.getUserService().GetUser({ userId: user.userId }),
    ).catch(() => null);
    const username =
      (profile && typeof profile === 'object' && 'username' in profile
        ? (profile as { username?: string }).username
        : undefined) ?? undefined;
    if (username !== ADMIN_USERNAME) {
      throw new ForbiddenException('Доступ только для администратора');
    }
    return true;
  }
}
