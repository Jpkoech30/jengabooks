import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  getStatus() {
    return {
      status: 'operational',
      agents: ['reconciliation', 'compliance', 'fraud-detection', 'advisory', 'hitl-resolution'],
    };
  }
}
