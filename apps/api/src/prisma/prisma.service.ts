import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  async onModuleInit() {
    const MAX_INIT_RETRIES = 5;
    for (let attempt = 1; attempt <= MAX_INIT_RETRIES; attempt++) {
      try {
        await this.$connect();
        this.isConnected = true;
        this.logger.log('Successfully connected to database');
        return;
      } catch (err) {
        const message = (err as Error).message;
        this.logger.warn(`DB connection attempt ${attempt}/${MAX_INIT_RETRIES} failed: ${message}`);
        if (attempt < MAX_INIT_RETRIES) {
          const delay = attempt * 2000;
          this.logger.log(`Retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    this.logger.warn('Database connection failed after all retries. App will start in degraded mode.');
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect();
    }
  }
}
