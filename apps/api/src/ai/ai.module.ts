import { Module } from '@nestjs/common';
import { AiController, ContentCalendarController } from './ai.controller';
import { AiProviderService } from './ai-provider.service';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController, ContentCalendarController],
  providers: [AiProviderService, AiService],
  exports: [AiService],
})
export class AiModule {}
