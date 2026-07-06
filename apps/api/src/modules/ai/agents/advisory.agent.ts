import { Injectable } from '@nestjs/common';

@Injectable()
export class AdvisoryAgent {
  async getAdvice(data: { companyId: string; query: string; context: Record<string, unknown> }) {
    // Placeholder - will integrate with DeepSeek V4
    return {
      advice: 'AI agent not yet configured',
      confidence: 0.5,
      supportingData: [],
      disclaimer: 'This is placeholder advice until DeepSeek V4 integration is complete.',
    };
  }
}
