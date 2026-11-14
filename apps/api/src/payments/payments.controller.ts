import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@amplyra/shared';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  FundCampaignDto,
  OpenDisputeDto,
  ReleasePaymentDto,
  ResolveDisputeDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('fund-campaign')
  @Roles(UserRole.BUSINESS)
  fundCampaign(@CurrentUser() user: AuthUser, @Body() dto: FundCampaignDto) {
    return this.paymentsService.fundCampaign(user.userId, dto);
  }

  @Get('business/ledger')
  @Roles(UserRole.BUSINESS)
  getBusinessLedger(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getBusinessLedger(user.userId);
  }

  @Get('creator/earnings')
  @Roles(UserRole.CREATOR)
  getCreatorEarnings(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getCreatorEarnings(user.userId);
  }

  @Get('disputes')
  @Roles(UserRole.ADMIN)
  listDisputes() {
    return this.paymentsService.listAllDisputes();
  }

  @Post('disputes/:disputeId/resolve')
  @Roles(UserRole.ADMIN)
  resolveDispute(
    @CurrentUser() user: AuthUser,
    @Param('disputeId') disputeId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.paymentsService.resolveDispute(user.userId, disputeId, dto);
  }

  @Get(':campaignId')
  getCampaignPayment(
    @CurrentUser() user: AuthUser,
    @Param('campaignId') campaignId: string,
  ) {
    return this.paymentsService.getCampaignPayment(user, campaignId);
  }

  @Post(':campaignId/release')
  @Roles(UserRole.BUSINESS, UserRole.ADMIN)
  releasePayment(
    @CurrentUser() user: AuthUser,
    @Param('campaignId') campaignId: string,
    @Body() dto: ReleasePaymentDto,
  ) {
    return this.paymentsService.releasePayment(user, campaignId, dto);
  }

  @Post(':campaignId/withdraw')
  @Roles(UserRole.CREATOR)
  withdrawEarnings(
    @CurrentUser() user: AuthUser,
    @Param('campaignId') campaignId: string,
  ) {
    return this.paymentsService.withdrawCreatorEarnings(user.userId, campaignId);
  }

  @Post(':campaignId/dispute')
  @Roles(UserRole.BUSINESS, UserRole.CREATOR)
  openDispute(
    @CurrentUser() user: AuthUser,
    @Param('campaignId') campaignId: string,
    @Body() dto: OpenDisputeDto,
  ) {
    return this.paymentsService.openDispute(user, campaignId, dto);
  }

  @Post(':campaignId/refund-request')
  @Roles(UserRole.BUSINESS)
  requestRefund(
    @CurrentUser() user: AuthUser,
    @Param('campaignId') campaignId: string,
    @Body() body?: { reason?: string },
  ) {
    return this.paymentsService.requestRefund(user, campaignId, body?.reason);
  }
}
