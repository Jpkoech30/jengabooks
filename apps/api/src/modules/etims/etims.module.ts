import { Module } from '@nestjs/common';
import { EtimsService } from './etims.service';
import { EtimsController } from './etims.controller';
import { CircuitBreakerService } from './circuit-breaker.service';
import { EtimsRetryWorker } from '../../queues/etims.queue';
import { QueueModule } from '../../queues/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [EtimsController],
  providers: [EtimsService, CircuitBreakerService, EtimsRetryWorker],
  exports: [EtimsService, CircuitBreakerService],
})
export class EtimsModule {}
