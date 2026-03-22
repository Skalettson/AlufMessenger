import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { DashboardAuthGuard } from '../auth/dashboard-auth.guard.js';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get('summary')
  async summary() {
    return this.dashboard.getSummary();
  }

  /** Сводка по счетам Mini-Apps — только с токеном панели (см. Next proxy). */
  @Get('payments')
  @UseGuards(DashboardAuthGuard)
  async paymentsOverview() {
    return this.paymentsService.getDashboardOverview();
  }
}
