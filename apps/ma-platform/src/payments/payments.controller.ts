import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Headers,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { AuthGuard } from '../auth/auth.guard.js';

type AuthedRequest = {
  user?: { appId: string; userId: string };
  headers: Record<string, string | string[] | undefined>;
};

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('invoice')
  @UseGuards(AuthGuard)
  async createInvoice(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      title: string;
      description: string;
      amount: number;
      currency: string;
      payload?: string;
    },
  ) {
    const appId = req.user?.appId ?? String(req.headers['x-aluf-app-id'] ?? '').trim();
    const userId = req.user?.userId ?? String(req.headers['x-aluf-user-id'] ?? '').trim();
    if (!appId || !userId) {
      throw new BadRequestException('x-aluf-app-id and x-aluf-user-id are required');
    }
    return this.paymentsService.createInvoice({
      appId,
      userId,
      ...body,
    });
  }

  @Get('invoice/:id')
  @UseGuards(AuthGuard)
  async getInvoice(@Param('id') id: string) {
    const invoice = await this.paymentsService.getInvoice(id);
    if (!invoice) {
      return { error: 'Invoice not found' };
    }
    return invoice;
  }

  @Post('invoice/:id/pay')
  @UseGuards(AuthGuard)
  async payInvoice(@Param('id') id: string) {
    const invoice = await this.paymentsService.payInvoice(id);
    return { success: !!invoice, invoice };
  }

  @Post('invoice/:id/refund')
  @UseGuards(AuthGuard)
  async refundInvoice(@Param('id') id: string) {
    const invoice = await this.paymentsService.refundInvoice(id);
    return { success: !!invoice, invoice };
  }

  @Get('invoices')
  @UseGuards(AuthGuard)
  async getInvoices(@Headers('x-aluf-user-id') userId: string) {
    if (!userId?.trim()) {
      throw new BadRequestException('x-aluf-user-id header is required');
    }
    const invoices = await this.paymentsService.getInvoicesByUser(userId.trim());
    return { invoices };
  }
}
