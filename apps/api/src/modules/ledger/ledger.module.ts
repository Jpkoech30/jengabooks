import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';
import { FiscalPeriodsService } from './fiscal-periods.service';

@Module({
  controllers: [LedgerController],
  providers: [LedgerService, FiscalPeriodsService],
  exports: [LedgerService, FiscalPeriodsService],
})
export class LedgerModule {}
