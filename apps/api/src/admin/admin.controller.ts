import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@amplyra/shared';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('businesses')
  listBusinesses() {
    return this.adminService.listBusinesses();
  }

  @Post('businesses/:id/verify')
  verifyBusiness(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.adminService.verifyBusiness(user.userId, id);
  }

  @Get('creators')
  listCreators() {
    return this.adminService.listCreators();
  }

  @Post('creators/:id/verify')
  verifyCreator(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.adminService.verifyCreator(user.userId, id);
  }

  @Get('campaigns')
  listCampaigns() {
    return this.adminService.listCampaigns();
  }
}
