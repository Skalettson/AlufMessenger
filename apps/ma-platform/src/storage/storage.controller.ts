import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { StorageService } from './storage.service.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get()
  @UseGuards(AuthGuard)
  async get(
    @Query('key') key: string,
    @Query('scope') scope: 'user' | 'app' | 'global' = 'app',
    @Headers('x-aluf-app-id') appId: string,
    @Headers('x-aluf-user-id') userId: string,
  ) {
    const value = await this.storageService.get(
      key,
      appId,
      scope,
      scope === 'user' ? userId : undefined,
    );
    return { key, value };
  }

  @Post()
  @UseGuards(AuthGuard)
  async set(
    @Body()
    body: {
      key: string;
      value: unknown;
      scope?: 'user' | 'app' | 'global';
      ttl?: number;
    },
    @Headers('x-aluf-app-id') appId: string,
    @Headers('x-aluf-user-id') userId: string,
  ) {
    await this.storageService.set(
      body.key,
      body.value,
      appId,
      body.scope || 'app',
      body.scope === 'user' ? userId : undefined,
      { ttl: body.ttl },
    );
    return { success: true };
  }

  @Delete()
  @UseGuards(AuthGuard)
  async remove(
    @Query('key') key: string,
    @Query('scope') scope: 'user' | 'app' | 'global' = 'app',
    @Headers('x-aluf-app-id') appId: string,
    @Headers('x-aluf-user-id') userId: string,
  ) {
    const deleted = await this.storageService.remove(
      key,
      appId,
      scope,
      scope === 'user' ? userId : undefined,
    );
    return { success: deleted };
  }

  @Get('keys')
  @UseGuards(AuthGuard)
  async keys(
    @Headers('x-aluf-app-id') appId: string,
    @Headers('x-aluf-user-id') userId: string,
    @Query('scope') scope: 'user' | 'app' | 'global' = 'app',
    @Query('pattern') pattern?: string,
  ) {
    const keys = await this.storageService.keys(
      appId,
      scope,
      scope === 'user' ? userId : undefined,
      pattern,
    );
    return { keys };
  }

  @Delete('clear')
  @UseGuards(AuthGuard)
  async clear(
    @Query('scope') scope: 'user' | 'app' | 'global' = 'app',
    @Headers('x-aluf-app-id') appId: string,
    @Headers('x-aluf-user-id') userId: string,
  ) {
    const count = await this.storageService.clear(
      appId,
      scope,
      scope === 'user' ? userId : undefined,
    );
    return { success: true, count };
  }
}
