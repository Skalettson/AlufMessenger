import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'custom-emoji-service', timestamp: new Date().toISOString() };
  }
}
