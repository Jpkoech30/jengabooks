import { Injectable, Logger, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { StatementRepository } from '../../prisma/repositories/statement.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { FileStorageService } from './storage/file-storage.service';
import { ParserRegistry } from './parsers/parser-registry.service';
import { Queue } from 'bullmq';
import { STATEMENT_UPLOAD_QUEUE } from '../../queues/queue.module';

@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly parserRegistry: ParserRegistry,
    @Inject(STATEMENT_UPLOAD_QUEUE) private readonly statementUploadQueue: Queue | null,
  ) { }

  /**
   * Upload a statement file and enqueue it for async processing.
   */
  async uploadStatement(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    userSelectedInstitution?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Determine file type
    const ext = file.originalname?.split('.').pop()?.toLowerCase() || '';
    let fileType: string;
    if (ext === 'pdf' || file.mimetype === 'application/pdf') {
      fileType = 'PDF';
    } else if (['csv', 'txt'].includes(ext)) {
      fileType = 'CSV';
    } else if (['xlsx', 'xls'].includes(ext)) {
      fileType = 'XLSX';
    } else {
      throw new BadRequestException(`Unsupported file type: .${ext}. Supported: PDF, CSV, XLSX`);
    }

    // Determine institution (auto-detect or user-selected)
    const institution = userSelectedInstitution || 'OTHER';
    const detectedBy = userSelectedInstitution ? 'USER_SELECTED' : 'AUTO';

    // Save file to local filesystem
    const { filePath, fileSize } = await this.fileStorage.saveFile(
      tenantId,
      institution,
      file,
    );

    // Create StatementUpload record
    const upload = await this.prisma.statementUpload.create({
      data: {
        tenantId,
        uploadedBy: userId,
        fileName: file.originalname,
        filePath,
        fileType,
        fileSize,
        institution: userSelectedInstitution || 'OTHER',
        detectedBy,
        status: 'PENDING_PARSING',
      },
    });

    if (this.statementUploadQueue) {
      await this.statementUploadQueue.add('process-upload', {
        uploadId: upload.id,
        tenantId,
        userId,
        filePath,
        fileType,
        userSelectedInstitution,
      }, {
        // Deduplicate by upload ID
        deduplication: { id: upload.id },
      });

      this.logger.log(`Upload ${upload.id} enqueued for processing`);
    } else {
      this.logger.warn(`Upload ${upload.id} saved but no queue available (Redis down). Process manually.`);
    }

    return {
      uploadId: upload.id,
      status: 'PENDING_PARSING',
      message: 'File uploaded and queued for processing',
    };
  }

  /**
   * Get a single upload by ID.
   */
  async getUpload(tenantId: string, uploadId: string) {
    const upload = await this.prisma.statementUpload.findFirst({
      where: { id: uploadId, tenantId },
    });

    if (!upload) {
      throw new NotFoundException(`Upload ${uploadId} not found`);
    }

    return upload;
  }

  /**
   * List all uploads for a tenant with optional filters.
   */
  async listUploads(tenantId: string, filters?: {
    status?: string;
    institution?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.institution) where.institution = filters.institution;

    const [items, total] = await Promise.all([
      this.prisma.statementUpload.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.statementUpload.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
