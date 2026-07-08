import { Module, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { HitlModule } from '../hitl/hitl.module';
import { GamificationModule } from '../gamification/gamification.module';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';
import { FileStorageService } from './storage/file-storage.service';
import { ParserRegistry } from './parsers/parser-registry.service';
import { MpesaParser } from './parsers/mpesa.parser';
import { KcbParser } from './parsers/kcb.parser';
import { createStatementUploadWorker } from './workers/statement-upload.worker';
import { createStatementClassificationWorker } from './workers/statement-classification.worker';
import { STATEMENT_CLASSIFICATION_QUEUE } from '../../queues/queue.module';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    ScheduleModule.forRoot(),
    HitlModule,
    GamificationModule,
  ],
  controllers: [StatementsController],
  providers: [
    StatementsService,
    FileStorageService,
    ParserRegistry,
    MpesaParser,
    KcbParser,
  ],
  exports: [StatementsService, ParserRegistry],
})
export class StatementsModule implements OnModuleInit {
  private readonly logger = new Logger(StatementsModule.name);

  constructor(
    private readonly parserRegistry: ParserRegistry,
    private readonly mpesaParser: MpesaParser,
    private readonly kcbParser: KcbParser,
    private readonly fileStorageService: FileStorageService,
    private readonly prisma: PrismaService,
    @Inject(STATEMENT_CLASSIFICATION_QUEUE) private readonly classificationQueue: Queue | null,
  ) {}

  onModuleInit() {
    // Register parsers
    this.parserRegistry.register(this.mpesaParser);
    this.parserRegistry.register(this.kcbParser);
    this.logger.log(`Registered ${this.parserRegistry.count} parsers: MPESA, KCB`);

    // Start BullMQ workers if Redis is compatible
    this.startWorkers();
  }

  private startWorkers() {
    try {
      if (!this.classificationQueue) {
        this.logger.warn('BullMQ queue unavailable — workers not started');
        return;
      }

      // Attempt to create workers — BullMQ validates Redis version internally
      // and will log errors if Redis < 5.0.0. We catch to prevent crash floods.
      const uploadWorker = createStatementUploadWorker(
        this.prisma,
        this.parserRegistry,
        this.fileStorageService,
        this.classificationQueue,
      );

      const classificationWorker = createStatementClassificationWorker(
        this.prisma,
        null,
        null,
      );

      // Suppress Redis version errors by listening and ignoring them
      uploadWorker.on('error', () => { /* Redis version errors are non-fatal */ });
      classificationWorker.on('error', () => { /* Redis version errors are non-fatal */ });

      this.logger.log('BullMQ workers initialized');
    } catch (error: any) {
      this.logger.warn(`BullMQ workers not available: ${error.message}`);
    }
  }
}
