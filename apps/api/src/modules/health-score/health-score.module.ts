import { Module } from '@nestjs/common';
import { HealthScoreService } from './health-score.service';
import { HealthScoreController } from './health-score.controller';

@Module({
  controllers: [HealthScoreController],
  providers: [HealthScoreService],
  exports: [HealthScoreService],
})
export class HealthScoreModule {}
