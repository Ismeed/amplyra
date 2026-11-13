import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@amplyra/shared';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BusinessesService } from './businesses.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpsertBusinessDto } from './dto/upsert-business.dto';

@Controller('businesses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUSINESS)
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertBusinessDto) {
    return this.businessesService.create(user.userId, dto);
  }

  @Get('me')
  getMine(@CurrentUser() user: AuthUser) {
    return this.businessesService.getMine(user.userId);
  }

  @Patch('me')
  updateMine(@CurrentUser() user: AuthUser, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.updateMine(user.userId, dto);
  }

  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.businessesService.getDashboard(user.userId);
  }
}
