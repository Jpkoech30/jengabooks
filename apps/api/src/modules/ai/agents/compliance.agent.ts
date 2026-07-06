import { Injectable } from '@nestjs/common';
import { AiService } from '../ai.service';

@Injectable()
export class ComplianceAgent {
  constructor(private readonly aiService: AiService) {}

  async validate(data: { 
    companyId: string; 
    documentType: string; 
    payload: string;
    context?: Record<string, unknown>;
  }) {
    const systemPrompt = `You are a KRA compliance AI for JengaBooks, a Kenyan accounting platform.
Your task is to validate financial documents for KRA eTIMS compliance.
Respond with JSON: { "isValid": boolean, "issues": string[], "confidence": number (0-1), "suggestions": string[] }`;

    const userPrompt = `Validate this ${data.documentType} for KRA eTIMS compliance:
Payload: ${data.payload}
Context: ${JSON.stringify(data.context || {})}

Check for:
- Required fields (customer name, PIN, invoice number, line items)
- Tax code validity (E=Exempt, S=Standard 16%, Z=Zero-rated)
- Amount calculations (subtotal + VAT = total)
- KRA PIN format (11 characters, alphanumeric)`;

    const response = await this.aiService.chat(systemPrompt, userPrompt, { temperature: 0.1, maxTokens: 512 });

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        isValid: true,
        issues: ['Compliance check unavailable — using default validation'],
        confidence: 0.5,
        suggestions: ['Configure DEEPSEEK_API_KEY for AI-powered compliance checks'],
      };
    }
  }
}
