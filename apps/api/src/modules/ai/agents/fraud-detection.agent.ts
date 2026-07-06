import { Injectable } from '@nestjs/common';
import { AiService } from '../ai.service';

@Injectable()
export class FraudDetectionAgent {
  constructor(private readonly aiService: AiService) {}

  async analyze(data: { companyId: string; transactionId: string; amount: number; pattern: string }) {
    const systemPrompt = `You are a fraud detection AI for JengaBooks, a Kenyan accounting platform.
Analyze financial transactions for suspicious patterns.
Respond with JSON: { "fraudScore": number (0-1), "flags": string[], "reasoning": string, "recommendedAction": "APPROVE"|"FLAG"|"BLOCK" }`;

    const userPrompt = `Analyze this transaction for fraud indicators:
Amount: KES ${data.amount}
Pattern: ${data.pattern}
Transaction ID: ${data.transactionId}

Check for:
- Unusually large amounts compared to typical transactions
- Rapid successive transactions
- Transactions to unfamiliar accounts
- Round-number amounts that may indicate testing`;

    const response = await this.aiService.chat(systemPrompt, userPrompt, { temperature: 0.1, maxTokens: 256 });

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        fraudScore: 0.1,
        flags: [],
        reasoning: 'Fraud detection service unavailable — auto-approving',
        recommendedAction: 'APPROVE',
      };
    }
  }
}
