import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);
  private redis: Redis | null = null;
  private initialized = false;

  private getClient(): Redis {
    if (!this.redis) {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 5) {
            this.logger.warn('Redis connection retries exhausted. Giving up.');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.redis.on('error', (err) => {
        this.logger.warn(`Redis client error: ${err.message}`);
      });
    }
    return this.redis;
  }

  async isHealthy(key: string): Promise<{ [key: string]: { status: string; pingResponse?: string; message?: string } }> {
    try {
      if (!this.initialized) {
        const client = this.getClient();
        await client.connect();
        this.initialized = true;
      }

      const ping = await this.redis!.ping();
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
