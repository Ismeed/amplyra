import { Global, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { VerificationCronController } from './verification-cron.controller';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Global()
@Module({
  imports: [AiModule],
  controllers: [VerificationController, VerificationCronController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
