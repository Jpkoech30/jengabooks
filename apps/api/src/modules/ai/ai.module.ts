import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { ReconciliationAgent } from './agents/reconciliation.agent';
import { ComplianceAgent } from './agents/compliance.agent';
import { FraudDetectionAgent } from './agents/fraud-detection.agent';
import { AdvisoryAgent } from './agents/advisory.agent';
import { HitlResolutionAgent } from './agents/hitl-resolution.agent';

@Module({
  providers: [
    AiService,
    ReconciliationAgent,
    ComplianceAgent,
    FraudDetectionAgent,
    AdvisoryAgent,
    HitlResolutionAgent,
  ],
  exports: [
    AiService,
    ReconciliationAgent,
    ComplianceAgent,
    FraudDetectionAgent,
    AdvisoryAgent,
    HitlResolutionAgent,
  ],
})
export class AiModule {}
