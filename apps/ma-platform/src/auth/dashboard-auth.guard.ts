import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Защита мутаций панели (POST/DELETE приложений).
 * В production нужен заголовок X-Ma-Dashboard-Token = MA_DASHBOARD_API_TOKEN.
 * В development без токена в env — разрешено (удобство локально).
 */
@Injectable()
export class DashboardAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    const secret = process.env.MA_DASHBOARD_API_TOKEN?.trim();
    if (!secret) {
      throw new UnauthorizedException(
        'MA_DASHBOARD_API_TOKEN is not set — configure for production',
      );
    }
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const raw = req.headers['x-ma-dashboard-token'];
    const token = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (!token || token !== secret) {
      throw new UnauthorizedException('Invalid dashboard token');
    }
    return true;
  }
}
