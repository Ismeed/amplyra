import {
  Body,
  Controller,
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
import { CampaignsService } from './campaigns.service';
import {
  ApplyToCampaignDto,
  CreateCampaignDto,
  InviteCreatorDto,
  ReviewApplicationDto,
  SubmitCampaignPostDto,
} from './dto/campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @Roles(UserRole.BUSINESS)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(user.userId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('q') q?: string,
  ) {
    return this.campaignsService.list(user, { category, city, q });
  }

  @Get('creator/my-work')
  @Roles(UserRole.CREATOR)
  getCreatorWork(@CurrentUser() user: AuthUser) {
    return this.campaignsService.getCreatorWork(user.userId);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.campaignsService.getById(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.BUSINESS)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(user.userId, id, dto);
  }

  @Post(':id/publish')
  @Roles(UserRole.BUSINESS)
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.campaignsService.publish(user.userId, id);
  }

  @Post(':id/apply')
  @Roles(UserRole.CREATOR)
  apply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ApplyToCampaignDto,
  ) {
    return this.campaignsService.apply(user.userId, id, dto);
  }

  @Post(':id/invite')
  @Roles(UserRole.BUSINESS)
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InviteCreatorDto,
  ) {
    return this.campaignsService.inviteCreator(user.userId, id, dto);
  }

  @Post(':id/approve-creator')
  @Roles(UserRole.BUSINESS)
  reviewApplication(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.campaignsService.reviewApplication(user.userId, id, dto);
  }

  @Post(':id/accept')
  @Roles(UserRole.CREATOR)
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.campaignsService.acceptCampaign(user.userId, id);
  }

  @Post(':id/posts')
  @Roles(UserRole.CREATOR)
  submitPost(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitCampaignPostDto,
  ) {
    return this.campaignsService.submitPost(user.userId, id, dto);
  }

  @Get(':id/posts')
  listPosts(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.campaignsService.listPosts(user, id);
  }
}
