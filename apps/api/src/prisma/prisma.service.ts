import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  async onModuleInit() {
    await this.$connect()
      .then(() => {
        this.isConnected = true;
        this.logger.log('Successfully connected to database');
      })
      .catch((err) => {
        this.logger.warn(`Database connection failed on startup: ${err.message}`);
        this.logger.warn('The app will start but database queries will fail until connection is restored');
      });
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect();
    }
  }
}
