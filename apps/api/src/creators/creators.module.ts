import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';

@Module({
  imports: [PaymentsModule],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
