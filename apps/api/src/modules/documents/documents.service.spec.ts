import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;

  const mockCompanyId = 'company-1';
  const mockUserId = 'user-1';

  const mockPrisma = {
    document: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    documentVersion: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('uploadDocument', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'bank-statement.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('fake pdf content'),
      size: 1024,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const dto = {
      companyId: mockCompanyId,
      category: 'BANK_STATEMENT' as const,
      description: 'June 2026 bank statement',
      tags: ['bank', 'june-2026'],
    };

    it('should upload a document and create version v1', async () => {
      const expectedDoc = {
        id: 'doc_123',
        companyId: mockCompanyId,
        fileName: expect.any(String),
        originalName: 'bank-statement.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        category: 'BANK_STATEMENT',
        description: 'June 2026 bank statement',
        tags: ['bank', 'june-2026'],
        uploadedById: mockUserId,
        currentVersion: 1,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          document: {
            create: jest.fn().mockResolvedValue(expectedDoc),
          },
          documentVersion: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.uploadDocument(mockFile, dto, mockUserId);

      expect(result).toBeDefined();
      expect(result.id).toBe('doc_123');
      expect(result.fileName).toBe('bank-statement.pdf');
      expect(result.version).toBe(1);
    });

    it('should reject files larger than 20MB', async () => {
      const oversizedFile = { ...mockFile, size: 25 * 1024 * 1024 };

      await expect(
        service.uploadDocument(oversizedFile, dto, mockUserId),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should reject unsupported file types', async () => {
      const invalidFile = {
        ...mockFile,
        originalname: 'script.exe',
        mimetype: 'application/x-msdownload',
      };

      await expect(
        service.uploadDocument(invalidFile, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject missing file', async () => {
      await expect(
        service.uploadDocument(null as any, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listDocuments', () => {
    it('should return paginated documents', async () => {
      const mockDocs = [
        {
          id: 'doc_1',
          companyId: mockCompanyId,
          originalName: 'stmt.pdf',
          fileSize: 1000,
          mimeType: 'application/pdf',
          category: 'BANK_STATEMENT',
          description: null,
          tags: null,
          currentVersion: 1,
          uploadedById: mockUserId,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocs);

      const result = await service.listDocuments({
        companyId: mockCompanyId,
        category: 'BANK_STATEMENT',
      });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.data[0].id).toBe('doc_1');
    });

    it('should return empty list when no documents match', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      const result = await service.listDocuments({
        companyId: mockCompanyId,
      });

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getDocument', () => {
    it('should return document metadata when found', async () => {
      const mockDoc = {
        id: 'doc_1',
        companyId: mockCompanyId,
        originalName: 'stmt.pdf',
        fileSize: 1000,
        mimeType: 'application/pdf',
        category: 'BANK_STATEMENT',
        description: 'Test',
        tags: null,
        currentVersion: 1,
        uploadedById: mockUserId,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.document.findUnique.mockResolvedValue(mockDoc);

      const result = await service.getDocument('doc_1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('doc_1');
    });

    it('should return null when document not found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      const result = await service.getDocument('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when document is soft-deleted', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc_1',
        isDeleted: true,
      });

      const result = await service.getDocument('doc_1');

      expect(result).toBeNull();
    });
  });

  describe('updateDocument', () => {
    it('should update document metadata', async () => {
      const existingDoc = {
        id: 'doc_1',
        companyId: mockCompanyId,
        isDeleted: false,
      };

      const updatedDoc = {
        ...existingDoc,
        originalName: 'stmt.pdf',
        fileSize: 1000,
        mimeType: 'application/pdf',
        category: 'RECEIPT',
        description: 'Updated description',
        tags: ['new-tag'],
        currentVersion: 1,
        uploadedById: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.document.findFirst.mockResolvedValue(existingDoc);
      mockPrisma.document.update.mockResolvedValue(updatedDoc);

      const result = await service.updateDocument('doc_1', mockCompanyId, {
        description: 'Updated description',
        category: 'RECEIPT',
        tags: ['new-tag'],
      });

      expect(result).toBeDefined();
      expect(result!.description).toBe('Updated description');
      expect(result!.category).toBe('RECEIPT');
    });

    it('should return null when document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const result = await service.updateDocument('nonexistent', mockCompanyId, {
        description: 'test',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteDocument', () => {
    it('should soft-delete a document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc_1',
        companyId: mockCompanyId,
        isDeleted: false,
      });
      mockPrisma.document.update.mockResolvedValue({ isDeleted: true });

      const result = await service.deleteDocument('doc_1', mockCompanyId);

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc_1' },
        data: { isDeleted: true },
      });
    });

    it('should return null when document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const result = await service.deleteDocument('nonexistent', mockCompanyId);

      expect(result).toBeNull();
    });
  });

  describe('uploadNewVersion', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'updated-statement.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('updated content'),
      size: 2048,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    it('should create a new version and increment currentVersion', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc_1',
        isDeleted: false,
        currentVersion: 1,
      });

      const expectedUpdated = {
        id: 'doc_1',
        companyId: mockCompanyId,
        originalName: 'original.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        category: 'BANK_STATEMENT',
        description: null,
        tags: null,
        currentVersion: 2,
        uploadedById: mockUserId,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          documentVersion: {
            findFirst: jest.fn().mockResolvedValue({ version: 1 }),
            create: jest.fn().mockResolvedValue({}),
          },
          document: {
            update: jest.fn().mockResolvedValue(expectedUpdated),
          },
        };
        return cb(tx);
      });

      const result = await service.uploadNewVersion('doc_1', mockFile, mockUserId);

      expect(result).toBeDefined();
      expect(result!.version).toBe(2);
    });

    it('should return null when document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      const result = await service.uploadNewVersion('doc_1', mockFile, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('listVersions', () => {
    it('should return all versions for a document', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc_1',
        isDeleted: false,
        currentVersion: 2,
      });

      mockPrisma.documentVersion.findMany.mockResolvedValue([
        { id: 'v1', version: 1, fileSize: 1000, mimeType: 'application/pdf', uploadedById: mockUserId, createdAt: new Date() },
        { id: 'v2', version: 2, fileSize: 2000, mimeType: 'application/pdf', uploadedById: mockUserId, createdAt: new Date() },
      ]);

      const result = await service.listVersions('doc_1');

      expect(result).toBeDefined();
      expect(result!.versions).toHaveLength(2);
      expect(result!.currentVersion).toBe(2);
    });

    it('should return null when document not found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      const result = await service.listVersions('doc_1');

      expect(result).toBeNull();
    });
  });
});
