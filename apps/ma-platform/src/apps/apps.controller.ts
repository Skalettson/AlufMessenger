import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Delete,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AppsService, type MiniApp } from './apps.service.js';
import { DashboardAuthGuard } from '../auth/dashboard-auth.guard.js';

const ALLOWED_STATUS = new Set(['draft', 'active', 'review', 'archived']);

type CreateMiniAppBody = {
  name: string;
  version?: string;
  description?: string;
  category?: string;
  url: string;
  icon?: string;
  settings?: Record<string, unknown>;
  status?: string;
};

@Controller('apps')
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Get()
  async getApps(@Query('category') category?: string) {
    if (category) {
      return this.appsService.findByCategory(category);
    }
    return this.appsService.findAll();
  }

  @Get('search')
  async searchApps(@Query('q') query: string) {
    if (!query?.trim()) {
      return [];
    }
    return this.appsService.search(query);
  }

  @Get(':id')
  async getApp(@Param('id') id: string) {
    const app = await this.appsService.findById(id);
    if (!app) {
      throw new NotFoundException('App not found');
    }
    return app;
  }

  @Post()
  @UseGuards(DashboardAuthGuard)
  async createApp(@Body() body: CreateMiniAppBody) {
    if (!body?.name?.trim() || !body?.url?.trim()) {
      throw new BadRequestException('name and url are required');
    }
    const status = (body.status ?? 'draft').trim();
    if (!ALLOWED_STATUS.has(status)) {
      throw new BadRequestException('Invalid status');
    }
    const payload: Omit<MiniApp, 'id' | 'createdAt' | 'updatedAt'> = {
      name: body.name.trim(),
      version: (body.version ?? '1.0.0').trim(),
      description: body.description?.trim() ?? null,
      category: (body.category ?? 'general').trim(),
      url: body.url.trim(),
      icon: body.icon?.trim() ?? null,
      settings: body.settings ?? {},
      status,
    };
    return this.appsService.create(payload);
  }

  @Delete(':id')
  @UseGuards(DashboardAuthGuard)
  async deleteApp(@Param('id') id: string) {
    const deleted = await this.appsService.delete(id);
    return { success: deleted };
  }
}
