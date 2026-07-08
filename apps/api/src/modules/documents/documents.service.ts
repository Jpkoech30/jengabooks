import { Injectable, Logger, BadRequestException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.xlsx', '.docx', '.jpg', '.jpeg', '.png'];
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'documents');

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly prisma: PrismaService) {
    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  /**
   * Upload a document (multipart file + metadata).
   * Creates a Document record and its first DocumentVersion (v1).
   * Uses a DB transaction to ensure atomic document + version creation.
   */
  async uploadDocument(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    uploadedById: string,
  ) {
    this.validateFile(file);

    const uuid = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    const storedFileName = `${uuid}${ext}`;
    const storagePath = path.join(UPLOAD_DIR, storedFileName);

    // Write file to disk
    fs.writeFileSync(storagePath, file.buffer);

    const result = await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          companyId: dto.companyId,
          fileName: storedFileName,
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          category: dto.category,
          description: dto.description || null,
          tags: dto.tags && dto.tags.length > 0 ? dto.tags : undefined,
          uploadedById,
          currentVersion: 1,
        },
      });

      await tx.documentVersion.create({
        data: {
          documentId: document.id,
          version: 1,
          fileName: storedFileName,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedById,
        },
      });

      return document;
    });

    return this.formatDocumentResponse(result);
  }

  /**
   * List documents with optional filtering by companyId and category.
   * Supports cursor-based pagination. Excludes soft-deleted documents.
   */
  async listDocuments(query: QueryDocumentsDto) {
    const limit = parseInt(query.limit || '50', 10);
    const take = Math.min(Math.max(limit, 1), 100);

    const where: any = {
      companyId: query.companyId,
      isDeleted: false,
    };

    if (query.category) {
      where.category = query.category;
    }

    if (query.cursor) {
      const cursorDoc = await this.prisma.document.findUnique({
        where: { id: query.cursor },
        select: { createdAt: true },
      });
      if (cursorDoc) {
        where.createdAt = { lt: cursorDoc.createdAt };
      }
    }

    const documents = await this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });

    const hasMore = documents.length > take;
    const items = hasMore ? documents.slice(0, take) : documents;

    return {
      data: items.map((doc) => this.formatDocumentResponse(doc)),
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
      hasMore,
    };
  }

  /**
   * Get a single document's metadata by ID.
   */
  async getDocument(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document || document.isDeleted) {
      return null;
    }

    return this.formatDocumentResponse(document);
  }

  /**
   * Download a document file.
   * Returns the file path and metadata for streaming.
   * If ?version=N is specified, returns that version's file.
   */
  async downloadDocument(id: string, version?: number) {
    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document || document.isDeleted) {
      return null;
    }

    let fileName: string;
    let fileSize: number;
    let mimeType: string;

    if (version && version > 0) {
      const docVersion = await this.prisma.documentVersion.findFirst({
        where: { documentId: id, version },
      });
      if (!docVersion) {
        return null;
      }
      fileName = docVersion.fileName;
      fileSize = docVersion.fileSize;
      mimeType = docVersion.mimeType;
    } else {
      // Get latest version (currentVersion)
      const latestVersion = await this.prisma.documentVersion.findFirst({
        where: { documentId: id },
        orderBy: { version: 'desc' },
      });
      if (!latestVersion) {
        return null;
      }
      fileName = latestVersion.fileName;
      fileSize = latestVersion.fileSize;
      mimeType = latestVersion.mimeType;
    }

    const filePath = path.join(UPLOAD_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`File not found on disk: ${filePath}`);
      return null;
    }

    return {
      filePath,
      originalName: document.originalName,
      mimeType,
      fileSize,
    };
  }

  /**
   * Update document metadata (description, tags, category).
   */
  async updateDocument(id: string, companyId: string, dto: UpdateDocumentDto) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId, isDeleted: false },
    });

    if (!document) {
      return null;
    }

    const updateData: any = {};
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.tags !== undefined) {
      updateData.tags = dto.tags.length > 0 ? dto.tags : undefined;
    }
    if (dto.category !== undefined) {
      updateData.category = dto.category;
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: updateData,
    });

    return this.formatDocumentResponse(updated);
  }

  /**
   * Soft-delete a document by setting isDeleted = true.
   */
  async deleteDocument(id: string, companyId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId, isDeleted: false },
    });

    if (!document) {
      return null;
    }

    await this.prisma.document.update({
      where: { id },
      data: { isDeleted: true },
    });

    return { deleted: true };
  }

  /**
   * Upload a new version of an existing document.
   * Creates a new DocumentVersion record and increments currentVersion.
   * Uses a DB transaction for atomic version increment.
   */
  async uploadNewVersion(
    documentId: string,
    file: Express.Multer.File,
    uploadedById: string,
  ) {
    this.validateFile(file);

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, isDeleted: false },
    });

    if (!document) {
      return null;
    }

    const uuid = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    const storedFileName = `${uuid}${ext}`;
    const storagePath = path.join(UPLOAD_DIR, storedFileName);

    // Write file to disk
    fs.writeFileSync(storagePath, file.buffer);

    const result = await this.prisma.$transaction(async (tx) => {
      // Get the next version number atomically
      const latestVersion = await tx.documentVersion.findFirst({
        where: { documentId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (latestVersion?.version || 0) + 1;

      // Create version record
      await tx.documentVersion.create({
        data: {
          documentId,
          version: nextVersion,
          fileName: storedFileName,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedById,
        },
      });

      // Update document's currentVersion
      const updated = await tx.document.update({
        where: { id: documentId },
        data: { currentVersion: nextVersion },
      });

      return updated;
    });

    return this.formatDocumentResponse(result);
  }

  /**
   * List all versions for a document.
   */
  async listVersions(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document || document.isDeleted) {
      return null;
    }

    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
    });

    return {
      documentId,
      currentVersion: document.currentVersion,
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        fileSize: v.fileSize,
        mimeType: v.mimeType,
        uploadedById: v.uploadedById,
        createdAt: v.createdAt,
      })),
    };
  }

  // ──────────────────────────────────────────────
  //  PRIVATE HELPERS
  // ──────────────────────────────────────────────

  /**
   * Validate uploaded file against size and type constraints.
   */
  private validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException('File exceeds maximum size of 20MB');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Unsupported file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported MIME type "${file.mimetype}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }
  }

  /**
   * Format document record into API response shape.
   */
  private formatDocumentResponse(doc: any) {
    return {
      id: doc.id,
      companyId: doc.companyId,
      fileName: doc.originalName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      category: doc.category,
      description: doc.description,
      tags: doc.tags,
      version: doc.currentVersion,
      uploadedBy: doc.uploadedById,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
