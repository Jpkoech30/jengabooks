import { Module } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { MpesaController } from './mpesa.controller';
import { HitlModule } from '../hitl/hitl.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [HitlModule, AiModule],
  controllers: [MpesaController],
  providers: [MpesaService],
  exports: [MpesaService],
})
export class MpesaModule {}
