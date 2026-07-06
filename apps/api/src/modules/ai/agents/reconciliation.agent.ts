import { Injectable } from '@nestjs/common';

@Injectable()
export class ReconciliationAgent {
  async reconcile(data: { companyId: string; description: string; amount: number; reference: string }) {
    // Placeholder - will integrate with DeepSeek V4
    return {
      accountId: 'suspense-account',
      confidence: 0.5,
      reasoning: 'AI agent not yet configured',
    };
  }
}
