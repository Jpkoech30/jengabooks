import { Module } from '@nestjs/common';
import { EtimsService } from './etims.service';
import { EtimsController } from './etims.controller';
import { CircuitBreakerService } from './circuit-breaker.service';

@Module({
  controllers: [EtimsController],
  providers: [EtimsService, CircuitBreakerService],
  exports: [EtimsService, CircuitBreakerService],
})
export class EtimsModule {}
