import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationService } from './collaboration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('CollaborationService', () => {
  let service: CollaborationService;
  let prisma: any;

  const mockCompanyId = 'company-1';
  const mockUserId = 'user-1';
  const mockUserName = 'Test User';

  const mockPrisma = {
    comment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    clientTask: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    statementUpload: {
      findMany: jest.fn(),
    },
    mpesaTransaction: {
      count: jest.fn(),
    },
    bankTransaction: {
      count: jest.fn(),
    },
    eTIMSSubmission: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    journalEntry: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CollaborationService>(CollaborationService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  //  COMMENTS
  // ──────────────────────────────────────────────

  describe('createComment', () => {
    const dto = {
      entityType: 'MPESA_TX',
      entityId: 'tx_123',
      content: '@Jane, what is this KSh 45,000 payment to Jumia?',
      mentions: ['user_456'],
      attachments: [],
    };

    it('should create a comment and return it', async () => {
      const expectedComment = {
        id: 'comment-1',
        companyId: mockCompanyId,
        entityType: 'MPESA_TX',
        entityId: 'tx_123',
        authorId: mockUserId,
        authorName: mockUserName,
        content: dto.content,
        mentions: ['user_456'],
        attachments: [],
        status: 'ACTIVE',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user_456' }]);
      mockPrisma.comment.create.mockResolvedValue(expectedComment);
      mockPrisma.notification.create.mockResolvedValue({});

      const result = await service.createComment(mockCompanyId, mockUserId, mockUserName, dto);

      expect(result).toEqual(expectedComment);
      expect(mockPrisma.comment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: mockCompanyId,
          entityType: 'MPESA_TX',
          entityId: 'tx_123',
          content: dto.content,
          mentions: ['user_456'],
          status: 'ACTIVE',
        }),
      });
    });

    it('should create a comment even with invalid mentions (silently filter)', async () => {
      const dtoWithInvalidMentions = { ...dto, mentions: ['nonexistent_user'] };
      mockPrisma.user.findMany.mockResolvedValue([]); // No valid users
      mockPrisma.comment.create.mockResolvedValue({
        ...dtoWithInvalidMentions,
        id: 'comment-2',
        companyId: mockCompanyId,
        authorId: mockUserId,
        authorName: mockUserName,
        mentions: undefined,
        status: 'ACTIVE',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createComment(mockCompanyId, mockUserId, mockUserName, dtoWithInvalidMentions);

      expect(result).toBeDefined();
      expect(mockPrisma.comment.create).toHaveBeenCalled();
      // Should not create notification for invalid mention
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('should create comment without mentions', async () => {
      const dtoNoMentions = { ...dto, mentions: [] };
      mockPrisma.comment.create.mockResolvedValue({
        id: 'comment-3',
        companyId: mockCompanyId,
        entityType: 'MPESA_TX',
        entityId: 'tx_123',
        authorId: mockUserId,
        authorName: mockUserName,
        content: dto.content,
        status: 'ACTIVE',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createComment(mockCompanyId, mockUserId, mockUserName, dtoNoMentions);

      expect(result).toBeDefined();
      expect(mockPrisma.comment.create).toHaveBeenCalled();
    });
  });

  describe('getComments', () => {
    it('should return comments with pagination', async () => {
      const query = { entityType: 'MPESA_TX', entityId: 'tx_123' };
      const mockComments = [
        { id: 'c1', companyId: mockCompanyId, entityType: 'MPESA_TX', entityId: 'tx_123', parentId: null, createdAt: new Date() },
        { id: 'c2', companyId: mockCompanyId, entityType: 'MPESA_TX', entityId: 'tx_123', parentId: null, createdAt: new Date() },
      ];

      mockPrisma.comment.findMany
        .mockResolvedValueOnce(mockComments) // top-level
        .mockResolvedValueOnce([]); // no replies

      const result = await service.getComments(mockCompanyId, query);

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should handle empty result', async () => {
      const query = { entityType: 'UNKNOWN', entityId: 'nonexistent' };

      mockPrisma.comment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getComments(mockCompanyId, query);

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('updateCommentStatus', () => {
    it('should update comment status to RESOLVED', async () => {
      const dto = { status: 'RESOLVED' };
      const mockComment = {
        id: 'c1',
        companyId: mockCompanyId,
        status: 'ACTIVE',
      };

      mockPrisma.comment.findFirst.mockResolvedValue(mockComment);
      mockPrisma.comment.update.mockResolvedValue({ ...mockComment, status: 'RESOLVED' });

      const result = await service.updateCommentStatus(mockCompanyId, 'c1', dto);

      expect(result?.status).toBe('RESOLVED');
    });

    it('should return null when comment not found', async () => {
      mockPrisma.comment.findFirst.mockResolvedValue(null);

      const result = await service.updateCommentStatus(mockCompanyId, 'nonexistent', { status: 'RESOLVED' });

      expect(result).toBeNull();
    });
  });

  describe('replyToComment', () => {
    const replyDto = {
      content: 'This is a reply',
      mentions: [],
      attachments: [],
    };

    it('should create a reply to an existing comment', async () => {
      const parentComment = {
        id: 'c1',
        companyId: mockCompanyId,
        entityType: 'MPESA_TX',
        entityId: 'tx_123',
      };

      mockPrisma.comment.findFirst.mockResolvedValue(parentComment);
      mockPrisma.comment.create.mockResolvedValue({
        id: 'reply-1',
        companyId: mockCompanyId,
        entityType: 'MPESA_TX',
        entityId: 'tx_123',
        parentId: 'c1',
        authorId: mockUserId,
        authorName: mockUserName,
        content: replyDto.content,
        status: 'ACTIVE',
      });

      const result = await service.replyToComment(mockCompanyId, 'c1', mockUserId, mockUserName, replyDto);

      expect(result).toBeDefined();
      expect(result!.parentId).toBe('c1');
    });

    it('should return null when parent comment not found', async () => {
      mockPrisma.comment.findFirst.mockResolvedValue(null);

      const result = await service.replyToComment(mockCompanyId, 'nonexistent', mockUserId, mockUserName, replyDto);

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  //  CLIENT TASKS
  // ──────────────────────────────────────────────

  describe('generateTasks', () => {
    beforeEach(() => {
      // Common mock setup for eTIMSSubmission.findMany
      mockPrisma.eTIMSSubmission.findMany.mockResolvedValue([]);
    });

    it('should generate tasks for clients', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: mockCompanyId, parentCompanyId: null });
      mockPrisma.company.findMany.mockResolvedValue([
        { id: 'client-1' },
        { id: 'client-2' },
      ]);

      // Mock all the checks for each client
      mockPrisma.statementUpload.findMany.mockResolvedValue([]);
      mockPrisma.mpesaTransaction.count.mockResolvedValue(15);
      mockPrisma.bankTransaction.count.mockResolvedValue(5);
      mockPrisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1' }); // recent activity exists

      // No existing tasks
      mockPrisma.clientTask.findFirst.mockResolvedValue(null);
      mockPrisma.clientTask.create.mockResolvedValue({});
      mockPrisma.clientTask.count.mockResolvedValue(3);

      const result = await service.generateTasks(mockCompanyId);

      expect(result.generatedCount).toBeDefined();
      expect(mockPrisma.clientTask.create).toHaveBeenCalled();
    });

    it('should handle company not found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      const result = await service.generateTasks(mockCompanyId);

      expect(result.generatedCount).toBe(0);
    });

    it('should not create duplicate tasks', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: mockCompanyId, parentCompanyId: null });
      mockPrisma.company.findMany.mockResolvedValue([{ id: 'client-1' }]);
      mockPrisma.statementUpload.findMany.mockResolvedValue([]);
      mockPrisma.mpesaTransaction.count.mockResolvedValue(12);
      mockPrisma.bankTransaction.count.mockResolvedValue(0);
      mockPrisma.journalEntry.findFirst.mockResolvedValue(null); // no activity

      // Existing task already exists for this client/category
      mockPrisma.clientTask.findFirst.mockResolvedValue({ id: 'existing-task' });

      const result = await service.generateTasks(mockCompanyId);

      // Should NOT create additional tasks since one already exists
      expect(mockPrisma.clientTask.create).not.toHaveBeenCalled();
    });
  });

  describe('getTasks', () => {
    it('should return tasks with filters', async () => {
      const query = { status: 'PENDING', clientId: 'client-1' };
      const mockTasks = [
        { id: 't1', companyId: mockCompanyId, title: 'Task 1', status: 'PENDING' },
      ];

      mockPrisma.clientTask.findMany.mockResolvedValue(mockTasks);

      const result = await service.getTasks(mockCompanyId, query);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Task 1');
    });
  });

  describe('updateTask', () => {
    it('should update task status', async () => {
      const dto = { status: 'COMPLETED' };
      mockPrisma.clientTask.findFirst.mockResolvedValue({ id: 't1', companyId: mockCompanyId });
      mockPrisma.clientTask.update.mockResolvedValue({ id: 't1', status: 'COMPLETED' });

      const result = await service.updateTask(mockCompanyId, 't1', dto);

      expect(result?.status).toBe('COMPLETED');
    });

    it('should return null for non-existent task', async () => {
      mockPrisma.clientTask.findFirst.mockResolvedValue(null);

      const result = await service.updateTask(mockCompanyId, 'nonexistent', { status: 'COMPLETED' });

      expect(result).toBeNull();
    });
  });

  describe('escalateTask', () => {
    it('should increment escalation count and update priority', async () => {
      mockPrisma.clientTask.findFirst.mockResolvedValue({
        id: 't1',
        companyId: mockCompanyId,
        escalationCount: 0,
        priority: 'MEDIUM',
      });
      mockPrisma.clientTask.update.mockResolvedValue({
        id: 't1',
        escalationCount: 1,
        status: 'ESCALATED',
        priority: 'HIGH',
      });

      const result = await service.escalateTask(mockCompanyId, 't1');

      expect(result?.escalationCount).toBe(1);
      expect(result?.priority).toBe('HIGH');
    });

    it('should return null for non-existent task', async () => {
      mockPrisma.clientTask.findFirst.mockResolvedValue(null);

      const result = await service.escalateTask(mockCompanyId, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  //  NOTIFICATIONS
  // ──────────────────────────────────────────────

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const dto = {
        userId: 'user_456',
        type: 'COMMENT_MENTION',
        title: 'Jane mentioned you',
        message: 'Jane mentioned you in a comment',
        link: '/mpesa?tx=NFK9Q1K4C8',
        channel: 'IN_APP',
      };

      const expectedNotification = {
        id: 'notif-1',
        companyId: mockCompanyId,
        ...dto,
        status: 'UNREAD',
      };

      mockPrisma.notification.create.mockResolvedValue(expectedNotification);

      const result = await service.createNotification(mockCompanyId, dto);

      expect(result).toEqual(expectedNotification);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: mockCompanyId,
          userId: 'user_456',
          type: 'COMMENT_MENTION',
          status: 'UNREAD',
        }),
      });
    });
  });

  describe('getNotifications', () => {
    it('should return notifications with unread count', async () => {
      const query = { userId: 'user_456', status: 'UNREAD' };
      const mockNotifications = [
        { id: 'n1', companyId: mockCompanyId, userId: 'user_456', status: 'UNREAD' },
      ];

      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.getNotifications(mockCompanyId, query);

      expect(result.data).toHaveLength(1);
      expect(result.unreadCount).toBe(1);
    });
  });

  describe('markNotificationRead', () => {
    it('should mark notification as read', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'n1',
        companyId: mockCompanyId,
        status: 'UNREAD',
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: 'n1',
        status: 'READ',
        readAt: new Date(),
      });

      const result = await service.markNotificationRead(mockCompanyId, 'n1');

      expect(result?.status).toBe('READ');
    });

    it('should return null for non-existent notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      const result = await service.markNotificationRead(mockCompanyId, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('markAllNotificationsRead', () => {
    it('should mark all unread notifications as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllNotificationsRead(mockCompanyId, { userId: 'user_456' });

      expect(result.updatedCount).toBe(5);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          companyId: mockCompanyId,
          userId: 'user_456',
          status: 'UNREAD',
        },
        data: expect.objectContaining({ status: 'READ' }),
      });
    });
  });
});
