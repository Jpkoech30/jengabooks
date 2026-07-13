import { Module } from '@nestjs/common';
import { RecurringJournalService } from './recurring-journal.service';
import { RecurringJournalController } from './recurring-journal.controller';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
    imports: [LedgerModule],
    controllers: [RecurringJournalController],
    providers: [RecurringJournalService],
    exports: [RecurringJournalService],
})
export class RecurringJournalModule { }
