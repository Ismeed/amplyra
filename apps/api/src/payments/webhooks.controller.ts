import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';

@Controller('webhooks/payments')
export class PaymentWebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Param('provider') provider: string,
    @Headers('x-paystack-signature') paystackSignature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: any,
  ) {
    const rawBody = req.rawBody
      ? req.rawBody.toString('utf8')
      : JSON.stringify(body ?? {});
    return this.paymentsService.handlePaymentWebhook(
      provider,
      rawBody,
      paystackSignature,
      body,
    );
  }
}
