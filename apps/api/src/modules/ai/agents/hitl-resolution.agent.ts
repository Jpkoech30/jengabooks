import { Injectable } from '@nestjs/common';
import { AiService } from '../ai.service';

@Injectable()
export class HitlResolutionAgent {
  constructor(private readonly aiService: AiService) {}

  async resolve(data: { companyId: string; caseId: string; context: Record<string, unknown> }) {
    const systemPrompt = `You are an HITL (Human-in-the-Loop) resolution AI for JengaBooks.
Analyze review cases and suggest resolutions to reduce human workload.
Respond with JSON: { "suggestedAction": "APPROVE"|"REJECT"|"ESCALATE_TO_HUMAN", "confidence": number (0-1), "reasoning": string, "alternatives": string[] }`;

    const userPrompt = `Resolve this HITL case:
Case ID: ${data.caseId}
Context: ${JSON.stringify(data.context)}

Consider:
- High confidence (>0.8) → auto-approve or reject
- Medium confidence (0.5-0.8) → suggest but escalate
- Low confidence (<0.5) → always escalate to human`;

    const response = await this.aiService.chat(systemPrompt, userPrompt, { temperature: 0.2, maxTokens: 256 });

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        suggestedAction: 'ESCALATE_TO_HUMAN',
        confidence: 0.3,
        reasoning: 'HITL resolution agent unavailable — escalating to human reviewer',
        alternatives: [],
      };
    }
  }
}
