import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MpesaService } from './mpesa.service';
import { MpesaController } from './mpesa.controller';
import { MpesaWebhookController } from './mpesa-webhook.controller';
import { PdfParserService } from './pdf-parser.service';
import { DarajaService } from './daraja.service';
import { DarajaRetryWorker } from '../../queues/daraja.queue';
import { HitlModule } from '../hitl/hitl.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    HitlModule,
    AiModule,
  ],
  controllers: [MpesaController, MpesaWebhookController],
  providers: [MpesaService, PdfParserService, DarajaService, DarajaRetryWorker],
  exports: [MpesaService, DarajaService],
})
export class MpesaModule {}
