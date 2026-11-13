import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@amplyra/shared';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AiService } from './ai.service';
import {
  AskAnalystDto,
  CreateCalendarItemDto,
  GenerateContentDto,
  GenerateStrategyDto,
  UpdateCalendarItemDto,
} from './dto/ai.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUSINESS)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('strategy')
  generateStrategy(
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateStrategyDto,
  ) {
    return this.aiService.generateStrategy(user.userId, dto);
  }

  @Get('strategies')
  listStrategies(@CurrentUser() user: AuthUser) {
    return this.aiService.listStrategies(user.userId);
  }

  @Post('content')
  generateContent(
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateContentDto,
  ) {
    return this.aiService.generateContent(user.userId, dto);
  }

  @Get('content')
  listContent(@CurrentUser() user: AuthUser) {
    return this.aiService.listGeneratedContent(user.userId);
  }

  @Post('analyst')
  askAnalyst(@CurrentUser() user: AuthUser, @Body() dto: AskAnalystDto) {
    return this.aiService.askAnalyst(user.userId, dto);
  }

  @Get('recommendations')
  getRecommendations(@CurrentUser() user: AuthUser) {
    return this.aiService.getRecommendations(user.userId);
  }
}

@Controller('content-calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUSINESS)
export class ContentCalendarController {
  constructor(private readonly aiService: AiService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.aiService.listCalendarItems(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCalendarItemDto,
  ) {
    return this.aiService.createCalendarItem(user.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarItemDto,
  ) {
    return this.aiService.updateCalendarItem(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.aiService.deleteCalendarItem(user.userId, id);
  }
}
