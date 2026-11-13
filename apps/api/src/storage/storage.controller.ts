import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateUploadUrlDto } from './dto/storage.dto';
import { StorageService } from './storage.service';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('status')
  getStatus() {
    return this.storageService.getStatus();
  }

  @Post('upload-url')
  createUploadUrl(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.storageService.createUploadSession(user, dto);
  }

  @Post('files/:fileId/confirm')
  confirmUpload(
    @CurrentUser() user: AuthUser,
    @Param('fileId') fileId: string,
  ) {
    return this.storageService.confirmUpload(user, fileId);
  }

  @Get('files/:fileId/signed-url')
  getSignedUrl(
    @CurrentUser() user: AuthUser,
    @Param('fileId') fileId: string,
  ) {
    return this.storageService.getAuthorizedAccessUrl(user, fileId);
  }

  @Get('campaigns/:campaignId/files')
  listCampaignFiles(
    @CurrentUser() user: AuthUser,
    @Param('campaignId') campaignId: string,
  ) {
    return this.storageService.listCampaignFiles(user, campaignId);
  }
}
