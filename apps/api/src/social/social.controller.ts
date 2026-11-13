import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SocialPlatform } from '@amplyra/shared';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SocialService } from './social.service';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  listAccounts(@CurrentUser() user: AuthUser) {
    return this.socialService.listAccounts(user.userId);
  }

  @Get(':platform/connect')
  @UseGuards(JwtAuthGuard)
  connect(
    @CurrentUser() user: AuthUser,
    @Param('platform') platformParam: string,
    @Query('handle') handle?: string,
  ) {
    const platform = this.parsePlatform(platformParam);
    return this.socialService.getConnectUrl(user.userId, platform, handle);
  }

  @Get(':platform/callback')
  callback(
    @Param('platform') platformParam: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('handle') handleHint?: string,
    @Query('accountName') accountNameHint?: string,
  ) {
    if (!code || !state) {
      throw new BadRequestException('Missing code or state parameter');
    }
    const platform = this.parsePlatform(platformParam);
    return this.socialService.handleCallback({
      platform,
      code,
      state,
      handleHint,
      accountNameHint,
    });
  }

  @Post('accounts/:id/refresh')
  @UseGuards(JwtAuthGuard)
  refreshAccount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.socialService.refreshAccount(user.userId, id);
  }

  @Delete('accounts/:id')
  @UseGuards(JwtAuthGuard)
  disconnectAccount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.socialService.disconnectAccount(user.userId, id);
  }

  private parsePlatform(raw: string): SocialPlatform {
    const upper = raw.toUpperCase() as SocialPlatform;
    if (!Object.values(SocialPlatform).includes(upper)) {
      throw new BadRequestException(`Unsupported social platform: ${raw}`);
    }
    return upper;
  }
}
