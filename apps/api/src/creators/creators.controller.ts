import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@amplyra/shared';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaymentsService } from '../payments/payments.service';
import { CreatorsService } from './creators.service';
import {
  CreatePortfolioItemDto,
  UpsertCreatorDto,
  UpsertCreatorSocialAccountDto,
} from './dto/creator.dto';
import { DiscoverCreatorsQueryDto } from './dto/discover-creators.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';

@Controller('creators')
export class CreatorsController {
  constructor(
    private readonly creatorsService: CreatorsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertCreatorDto) {
    return this.creatorsService.create(user.userId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  getMine(@CurrentUser() user: AuthUser) {
    return this.creatorsService.getMine(user.userId);
  }

  @Get('me/earnings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  getMyEarnings(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getCreatorEarnings(user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  updateMine(@CurrentUser() user: AuthUser, @Body() dto: UpdateCreatorDto) {
    return this.creatorsService.updateMine(user.userId, dto);
  }

  @Post('me/social-accounts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  upsertSocialAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertCreatorSocialAccountDto,
  ) {
    return this.creatorsService.upsertSocialAccount(user.userId, dto);
  }

  @Delete('me/social-accounts/:socialAccountId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  removeSocialAccount(
    @CurrentUser() user: AuthUser,
    @Param('socialAccountId') socialAccountId: string,
  ) {
    return this.creatorsService.removeSocialAccount(user.userId, socialAccountId);
  }

  @Post('me/portfolio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  addPortfolioItem(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePortfolioItemDto,
  ) {
    return this.creatorsService.addPortfolioItem(user.userId, dto);
  }

  @Delete('me/portfolio/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR)
  removePortfolioItem(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
  ) {
    return this.creatorsService.removePortfolioItem(user.userId, itemId);
  }

  @Get('discover')
  @UseGuards(JwtAuthGuard)
  discover(@Query() query: DiscoverCreatorsQueryDto) {
    return this.creatorsService.discover(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getById(@Param('id') id: string) {
    return this.creatorsService.getById(id);
  }

  @Get(':id/performance')
  @UseGuards(JwtAuthGuard)
  getPerformance(@Param('id') id: string) {
    return this.creatorsService.getPerformance(id);
  }
}
