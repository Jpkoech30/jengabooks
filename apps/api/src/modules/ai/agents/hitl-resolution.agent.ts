import { Injectable } from '@nestjs/common';

@Injectable()
export class HitlResolutionAgent {
  async resolve(data: { companyId: string; caseId: string; context: Record<string, unknown> }) {
    // Placeholder - will integrate with DeepSeek V4
    return {
      suggestedAction: 'ESCALATE_TO_HUMAN',
      confidence: 0.3,
      reasoning: 'AI agent not yet configured',
      alternatives: [],
    };
  }
}
