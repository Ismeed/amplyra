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
import { FlagReportDto, SubmitCampaignReportDto } from './dto/verification.dto';
import { VerificationService } from './verification.service';

@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post(':id/reports')
  @Roles(UserRole.CREATOR)
  submitReport(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitCampaignReportDto,
  ) {
    return this.verificationService.submitCreatorEvidenceReport(
      user.userId,
      id,
      dto,
    );
  }

  @Get(':id/reports')
  listReports(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.verificationService.listReports(user, id);
  }

  @Get(':id/analytics')
  getAnalytics(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.verificationService.getCampaignAnalytics(user, id);
  }

  @Post(':id/verify')
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.verificationService.runVerification(user, id);
  }

  @Post('reports/:reportId/flag')
  @Roles(UserRole.BUSINESS, UserRole.ADMIN)
  flagReport(
    @CurrentUser() user: AuthUser,
    @Param('reportId') reportId: string,
    @Body() dto: FlagReportDto,
  ) {
    return this.verificationService.flagReport(user, reportId, dto);
  }
}
