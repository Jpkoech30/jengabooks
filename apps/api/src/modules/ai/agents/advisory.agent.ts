import { Injectable } from '@nestjs/common';
import { AiService } from '../ai.service';

@Injectable()
export class AdvisoryAgent {
  constructor(private readonly aiService: AiService) {}

  async getAdvice(data: { companyId: string; query: string; context: Record<string, unknown> }) {
    const systemPrompt = `You are a business advisory AI for JengaBooks, a Kenyan accounting platform.
Provide clear, actionable business advice based on the user's financial data.
Keep responses concise (under 500 characters for SMS compatibility).
Respond with JSON: { "advice": string, "confidence": number (0-1), "supportingData": string[], "disclaimer": string }`;

    const userPrompt = `Query: ${data.query}
Context: ${JSON.stringify(data.context)}

Provide business advice based on this context. Consider Kenyan SME best practices.`;

    const response = await this.aiService.chat(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 512 });

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        advice: 'AI advisory temporarily unavailable. Please try again later.',
        confidence: 0,
        supportingData: [],
        disclaimer: 'This is an automated response. Consult a professional accountant for critical decisions.',
      };
    }
  }
}
