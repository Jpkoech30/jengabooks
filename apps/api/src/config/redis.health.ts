import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 3,
    });
  }

  async isHealthy(key: string): Promise<{ [key: string]: { status: string; pingResponse?: string; message?: string } }> {
    try {
      const ping = await this.redis.ping();
      const isHealthy = ping === 'PONG';
      return {
        [key]: {
          status: isHealthy ? 'up' : 'down',
          pingResponse: ping,
        },
      };
    } catch (error) {
      return {
        [key]: {
          status: 'down',
          message: (error as Error).message,
        },
      };
    }
  }
}
