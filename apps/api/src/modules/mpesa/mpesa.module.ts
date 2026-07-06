import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MpesaService } from './mpesa.service';
import { MpesaController } from './mpesa.controller';
import { PdfParserService } from './pdf-parser.service';
import { HitlModule } from '../hitl/hitl.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MulterModule.register({ dest: './uploads' }),
    HitlModule,
    AiModule,
  ],
  controllers: [MpesaController],
  providers: [MpesaService, PdfParserService],
  exports: [MpesaService],
})
export class MpesaModule {}
