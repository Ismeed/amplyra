import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BusinessesModule } from './businesses/businesses.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { CreatorsModule } from './creators/creators.module';
import { HealthController } from './health.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { SocialModule } from './social/social.module';
import { VerificationModule } from './verification/verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    NotificationsModule,
    SocialModule,
    VerificationModule,
    AuthModule,
    BusinessesModule,
    CreatorsModule,
    CampaignsModule,
    PaymentsModule,
    AiModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
