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

interface UserServiceGrpc {
  UploadPreKeyBundle(req: {
    userId: string;
    bundle: {
      identityKey: string;
      signedPreKey: { keyId: number; publicKey: string; signature: string };
      oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
    };
  }): Observable<unknown>;
  GetPreKeyBundle(req: {
    userId: string;
    targetUserId: string;
  }): Observable<unknown>;
  GetOneTimeKeyCount(req: { userId: string }): Observable<unknown>;
}

@Controller('v1/keys')
export class E2eeRoutesController implements OnModuleInit {
  private userService!: UserServiceGrpc;

  constructor(
    @Inject('USER_SERVICE_PACKAGE') private readonly userClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.userService =
      this.userClient.getService<UserServiceGrpc>('UserService');
  }

  @Post('bundle')
  uploadPreKeyBundle(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      identityKey: string;
      signedPreKey: { keyId: number; publicKey: string; signature: string };
      oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
    },
  ) {
    return firstValueFrom(
      this.userService.UploadPreKeyBundle({
        userId: user.userId,
        bundle: body,
      }),
    );
  }

  @Get('bundle/:userId')
  getPreKeyBundle(
    @CurrentUser() user: RequestUser,
    @Param('userId') targetUserId: string,
  ) {
    return firstValueFrom(
      this.userService.GetPreKeyBundle({
        userId: user.userId,
        targetUserId,
      }),
    );
  }

  @Get('count')
  getOneTimeKeyCount(@CurrentUser() user: RequestUser) {
    return firstValueFrom(
      this.userService.GetOneTimeKeyCount({ userId: user.userId }),
    );
  }
}
