import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AiService } from './ai.service';
import { BatchService } from './batch.service';
import { ReconciliationAgent } from './agents/reconciliation.agent';
import { ComplianceAgent } from './agents/compliance.agent';
import { FraudDetectionAgent } from './agents/fraud-detection.agent';
import { AdvisoryAgent } from './agents/advisory.agent';
import { HitlResolutionAgent } from './agents/hitl-resolution.agent';
import { HitlModule } from '../hitl/hitl.module';

@Module({
  imports: [ScheduleModule.forRoot(), HitlModule],
  providers: [
    AiService,
    BatchService,
    ReconciliationAgent,
    ComplianceAgent,
    FraudDetectionAgent,
    AdvisoryAgent,
    HitlResolutionAgent,
  ],
  exports: [
    AiService,
    BatchService,
    ReconciliationAgent,
    ComplianceAgent,
    FraudDetectionAgent,
    AdvisoryAgent,
    HitlResolutionAgent,
  ],
})
export class AiModule {}
