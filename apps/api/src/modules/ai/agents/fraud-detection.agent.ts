import { Injectable } from '@nestjs/common';

@Injectable()
export class FraudDetectionAgent {
  async analyze(data: { companyId: string; transactionId: string; amount: number; pattern: string }) {
    // Placeholder - will integrate with DeepSeek V4
    return {
      fraudScore: 0.1,
      flags: [],
      reasoning: 'AI agent not yet configured',
      recommendedAction: 'APPROVE',
    };
  }
}
