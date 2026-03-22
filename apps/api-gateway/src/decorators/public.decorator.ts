import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export interface RequestUser {
  userId: string;
  sessionId: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: RequestUser & { user_id?: string; session_id?: string } }>();
    const u = request.user;
    if (!u) {
      return { userId: '', sessionId: '' };
    }
    const userId = (u.userId ?? (u as { user_id?: string }).user_id ?? '').trim();
    const sessionId = (u.sessionId ?? (u as { session_id?: string }).session_id ?? '').trim();
    return { userId, sessionId };
  },
);
