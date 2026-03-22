import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { CurrentUser } from '../decorators/public.decorator';
import type { RequestUser } from '../decorators/public.decorator';

function pickBool(obj: Record<string, unknown>, a: string, b: string): boolean | undefined {
  const v = obj[a] ?? obj[b];
  if (v === undefined) return undefined;
  return v !== false && v !== 'false' && v !== 0;
}

function pickStr(obj: Record<string, unknown>, a: string, b: string): string | undefined {
  const v = obj[a] ?? obj[b];
  if (v === undefined || v === null) return undefined;
  return String(v);
}

interface NotificationServiceGrpc {
  RegisterToken(req: { userId: string; token: string; platform: string; deviceId?: string }): Observable<unknown>;
  UnregisterToken(req: { userId: string; token: string; deviceId?: string }): Observable<unknown>;
  GetPreferences(req: { userId: string }): Observable<unknown>;
  UpdatePreferences(req: { userId: string; preferences: unknown }): Observable<unknown>;
}

@Controller('v1/notifications')
export class NotificationRoutesController implements OnModuleInit {
  private notificationService!: NotificationServiceGrpc;

  constructor(
    @Inject('NOTIFICATION_SERVICE_PACKAGE') private readonly notifClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.notificationService = this.notifClient.getService<NotificationServiceGrpc>('NotificationService');
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: RequestUser) {
    return firstValueFrom(this.notificationService.GetPreferences({ userId: user.userId }));
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    const p = body;
    const preferences = {
      messagesEnabled: pickBool(p, 'messagesEnabled', 'messages_enabled'),
      mentionsEnabled: pickBool(p, 'mentionsEnabled', 'mentions_enabled'),
      reactionsEnabled: pickBool(p, 'reactionsEnabled', 'reactions_enabled'),
      callsEnabled: pickBool(p, 'callsEnabled', 'calls_enabled'),
      groupInvitesEnabled: pickBool(p, 'groupInvitesEnabled', 'group_invites_enabled'),
      storiesEnabled: pickBool(p, 'storiesEnabled', 'stories_enabled'),
      showPreview: pickBool(p, 'showPreview', 'show_preview'),
      defaultSound: pickStr(p, 'defaultSound', 'default_sound'),
      vibrate: pickBool(p, 'vibrate', 'vibrate'),
    };
    return firstValueFrom(this.notificationService.UpdatePreferences({ userId: user.userId, preferences }));
  }

  @Post('token')
  registerToken(@CurrentUser() user: RequestUser, @Body() body: { token: string; platform?: string; deviceId?: string }) {
    return firstValueFrom(this.notificationService.RegisterToken({
      userId: user.userId,
      token: body.token,
      platform: body.platform || 'web',
      deviceId: body.deviceId,
    }));
  }

  @Delete('token')
  unregisterToken(@CurrentUser() user: RequestUser, @Body() body: { token: string; deviceId?: string }) {
    return firstValueFrom(this.notificationService.UnregisterToken({
      userId: user.userId,
      token: body.token,
      deviceId: body.deviceId,
    }));
  }
}
