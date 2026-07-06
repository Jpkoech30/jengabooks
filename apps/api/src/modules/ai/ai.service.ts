import { Injectable, Logger } from '@nestjs/common';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
    
    if (this.apiKey) {
      this.logger.log(`DeepSeek AI configured with base URL: ${this.baseUrl}`);
    } else {
      this.logger.warn('DEEPSEEK_API_KEY not set — AI agents will return placeholder responses');
    }
  }

  getStatus() {
    return {
      status: this.apiKey ? 'operational' : 'degraded',
      agents: ['reconciliation', 'compliance', 'fraud-detection', 'advisory', 'hitl-resolution'],
      deepseekConfigured: !!this.apiKey,
    };
  }

  /**
   * Send a prompt to DeepSeek V4 and get the response.
   * Falls back to a placeholder response if DEEPSEEK_API_KEY is not set.
   */
  async chat(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number; model?: string },
  ): Promise<{ content: string; tokenUsage?: { prompt: number; completion: number; total: number } }> {
    if (!this.apiKey) {
      // Placeholder response when API key is not configured
      return {
        content: JSON.stringify({
          result: 'placeholder',
          confidence: 0.5,
          reasoning: 'DeepSeek V4 integration not configured. Set DEEPSEEK_API_KEY environment variable.',
        }),
      };
    }

    try {
      const { default: axios } = await import('axios');
      const response = await axios.post<DeepSeekResponse>(
        `${this.baseUrl}/chat/completions`,
        {
          model: options?.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ] as DeepSeekMessage[],
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.maxTokens ?? 1024,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const data = response.data;
      const content = data.choices?.[0]?.message?.content || '';

      this.logger.log(`DeepSeek response: ${data.usage?.total_tokens || 0} tokens used`);

      return {
        content,
        tokenUsage: data.usage ? {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error: any) {
      this.logger.error(`DeepSeek API call failed: ${error.message}`);
      return {
        content: JSON.stringify({
          result: 'error',
          confidence: 0,
          reasoning: `AI service error: ${error.message}`,
        }),
      };
    }
  }
}
