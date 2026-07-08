import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { FeatureGuard } from './feature.guard';

@Module({
  controllers: [BillingController],
  providers: [BillingService, FeatureGuard],
  exports: [BillingService, FeatureGuard],
})
export class BillingModule {}
