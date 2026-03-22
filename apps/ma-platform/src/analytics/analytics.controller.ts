import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track')
  @HttpCode(HttpStatus.NO_CONTENT)
  async track(
    @Body()
    body: {
      event: string;
      properties?: Record<string, unknown>;
    },
    @Headers('x-aluf-app-id') appId: string,
    @Headers('x-aluf-user-id') userId?: string,
  ) {
    if (!appId?.trim()) {
      throw new BadRequestException('X-Aluf-App-Id header required');
    }
    await this.analyticsService.track(
      appId.trim(),
      body.event,
      body.properties,
      userId?.trim(),
    );
  }

  @Get('events')
  async getEvents(
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
    @Headers('x-aluf-app-id') appId: string,
  ) {
    if (!appId?.trim()) {
      throw new BadRequestException('X-Aluf-App-Id header required');
    }
    const events = await this.analyticsService.getEvents(
      appId.trim(),
      Number(limit) || 100,
      Number(offset) || 0,
    );
    return { events, total: events.length };
  }

  @Get('stats')
  async getStats(
    @Headers('x-aluf-app-id') appId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!appId?.trim()) {
      throw new BadRequestException('X-Aluf-App-Id header required');
    }
    const stats = await this.analyticsService.getStats(
      appId.trim(),
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    return { stats };
  }
}
