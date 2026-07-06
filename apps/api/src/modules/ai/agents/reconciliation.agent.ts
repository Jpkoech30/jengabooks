import { Injectable } from '@nestjs/common';
import { AiService } from '../ai.service';

@Injectable()
export class ReconciliationAgent {
  constructor(private readonly aiService: AiService) {}

  async reconcile(data: { companyId: string; description: string; amount: number; reference: string }) {
    const systemPrompt = `You are a financial reconciliation AI for JengaBooks, a Kenyan accounting platform.
Your task is to map transaction descriptions to Chart of Accounts entries.
Respond with JSON: { "accountCode": string, "confidence": number (0-1), "reasoning": string }`;

    const userPrompt = `Reconcile this transaction:
Description: ${data.description}
Amount: KES ${data.amount}
Reference: ${data.reference || 'N/A'}

Map to the most appropriate Chart of Account code. Consider:
- M-Pesa transactions → Cash/Bank accounts
- Payments to suppliers → Accounts Payable or relevant expense
- Customer payments → Accounts Receivable or Revenue
- Unknown transactions → Suspense Account (code: SUSPENSE)`;

    const response = await this.aiService.chat(systemPrompt, userPrompt, { temperature: 0.1, maxTokens: 256 });

    try {
      const parsed = JSON.parse(response.content);
      return {
        accountId: parsed.accountCode || 'suspense-account',
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'AI reconciliation result',
      };
    } catch {
      return {
        accountId: 'suspense-account',
        confidence: 0.3,
        reasoning: 'Failed to parse AI response. Falling back to suspense.',
      };
    }
  }
}
