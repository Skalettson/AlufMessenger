import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Inject,
  OnModuleInit,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { Public, CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  RegisterDto,
  LoginDto,
  VerifyDto,
  RefreshDto,
} from '../dto/auth.dto';

interface AuthServiceGrpc {
  Register(req: RegisterDto & { method: number }): Observable<unknown>;
  Login(req: LoginDto & { method: number }): Observable<unknown>;
  VerifyCode(req: { verificationId: string; code: string }): Observable<unknown>;
  VerifyLogin(req: Record<string, unknown>): Observable<unknown>;
  RefreshToken(req: RefreshDto): Observable<unknown>;
  GetSessions(req: { userId: string }): Observable<unknown>;
  TerminateSession(req: { userId: string; sessionId: string }): Observable<unknown>;
  Setup2FA(req: { userId: string }): Observable<unknown>;
  Verify2FA(req: { userId: string; code: string }): Observable<unknown>;
  Disable2FA(req: { userId: string; code: string }): Observable<unknown>;
  Logout(req: { userId: string; sessionId: string }): Observable<unknown>;
}

@Controller('v1/auth')
export class AuthRoutesController implements OnModuleInit {
  private authService!: AuthServiceGrpc;

  constructor(
    @Inject('AUTH_SERVICE_PACKAGE') private readonly authClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.authService = this.authClient.getService<AuthServiceGrpc>('AuthService');
  }

  @Public()
  @Post('register')
  register(@Body(new ZodValidationPipe(RegisterDto)) body: RegisterDto) {
    const method = 2; // email
    return firstValueFrom(this.authService.Register({ ...body, method }));
  }

  @Public()
  @Post('login')
  login(@Body(new ZodValidationPipe(LoginDto)) body: LoginDto) {
    const method = 2; // email
    return firstValueFrom(this.authService.Login({ ...body, method }));
  }

  @Public()
  @Post('verify')
  verify(@Req() req: Request, @Body(new ZodValidationPipe(VerifyDto)) body: VerifyDto) {
    const { verificationId, code, type, twoFactorCode } = body;
    if (type === 'login') {
      const xf = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
      const clientIp = xf || req.socket?.remoteAddress || '';
      const userAgent = (req.headers['user-agent'] as string | undefined) || '';
      return firstValueFrom(
        this.authService.VerifyLogin({
          verificationId,
          code,
          twoFactorCode,
          clientIp,
          userAgent,
        }),
      );
    }
    return firstValueFrom(
      this.authService.VerifyCode({ verificationId, code }),
    );
  }

  @Public()
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(RefreshDto)) body: RefreshDto) {
    return firstValueFrom(this.authService.RefreshToken(body));
  }

  @Get('sessions')
  getSessions(@CurrentUser() user: RequestUser) {
    const userId = (user?.userId ?? '').trim();
    if (!userId) {
      throw new UnauthorizedException('Сессия не определена. Войдите снова.');
    }
    return firstValueFrom(this.authService.GetSessions({ userId, user_id: userId } as { userId: string } & { user_id: string }));
  }

  @Delete('sessions/:id')
  terminateSession(@CurrentUser() user: RequestUser, @Param('id') sessionId: string) {
    return firstValueFrom(
      this.authService.TerminateSession({ userId: user.userId, sessionId }),
    );
  }

  @Post('2fa/setup')
  setup2FA(@CurrentUser() user: RequestUser) {
    return firstValueFrom(
      this.authService.Setup2FA({ userId: user.userId }),
    );
  }

  @Post('2fa/verify')
  verify2FA(@CurrentUser() user: RequestUser, @Body('code') code: string) {
    return firstValueFrom(
      this.authService.Verify2FA({ userId: user.userId, code }),
    );
  }

  @Post('2fa/disable')
  disable2FA(@CurrentUser() user: RequestUser, @Body() body: { code?: string }) {
    const code = (body.code ?? '').trim();
    if (!code) {
      throw new BadRequestException('Код 2FA обязателен');
    }
    return firstValueFrom(
      this.authService.Disable2FA({ userId: user.userId, code }),
    );
  }

  @Post('logout')
  logout(@CurrentUser() user: RequestUser) {
    return firstValueFrom(
      this.authService.Logout({ userId: user.userId, sessionId: user.sessionId }),
    );
  }
}
