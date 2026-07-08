import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 20 * 1024 * 1024, // 20MB
      },
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
