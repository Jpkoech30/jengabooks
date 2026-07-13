import { Injectable, Logger } from '@nestjs/common';
import { CollaborationRepository } from '../../prisma/repositories/collaboration.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReplyCommentDto } from './dto/reply-comment.dto';
import { UpdateCommentStatusDto } from './dto/update-comment-status.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { MarkAllReadDto } from './dto/mark-all-read.dto';

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  constructor(
    private readonly collaborationRepo: CollaborationRepository,
    private readonly prisma: PrismaService,
  ) { }

  // ──────────────────────────────────────────────
  //  COMMENTS
  // ──────────────────────────────────────────────

  /**
   * Create a comment on a transaction/entity.
   * Comments are created even if the entity doesn't exist (audit trail).
   */
  async createComment(companyId: string, authorId: string, authorName: string, dto: CreateCommentDto) {
    // Filter mentions to avoid crashing on invalid user IDs — silently ignore non-existent users
    const validMentions = await this.filterValidUserIds(dto.mentions || []);

    const comment = await this.prisma.comment.create({
      data: {
        companyId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        authorId,
        authorName,
        content: dto.content,
        mentions: validMentions.length > 0 ? validMentions : undefined,
        attachments: dto.attachments && dto.attachments.length > 0 ? dto.attachments : undefined,
        status: 'ACTIVE',
      },
    });

    // Create notifications for mentioned users
    if (validMentions.length > 0) {
      await this.createMentionNotifications(companyId, validMentions, authorName, dto.entityType, dto.entityId);
    }

    return comment;
  }

  /**
   * Get comments for an entity, ordered by creation date (oldest first).
   * Supports cursor-based pagination.
   */
  async getComments(companyId: string, query: QueryCommentsDto) {
    const limit = parseInt(query.limit || '50', 10);
    const take = Math.min(Math.max(limit, 1), 100);

    const where: any = {
      companyId,
      entityType: query.entityType,
      entityId: query.entityId,
      parentId: null, // Only top-level comments; replies are nested
    };

    if (query.cursor) {
      where.createdAt = { gt: await this.getCursorDate(query.cursor) };
    }

    const comments = await this.prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: take + 1,
    });

    const hasMore = comments.length > take;
    const items = hasMore ? comments.slice(0, take) : comments;

    // Fetch replies for each top-level comment
    const commentIds = items.map((c) => c.id);
    const replies = await this.prisma.comment.findMany({
      where: { parentId: { in: commentIds } },
      orderBy: { createdAt: 'asc' },
    });

    const replyMap = new Map<string, typeof replies>();
    for (const reply of replies) {
      const existing = replyMap.get(reply.parentId!) || [];
      existing.push(reply);
      replyMap.set(reply.parentId!, existing);
    }

    return {
      data: items.map((c) => ({
        ...c,
        replies: replyMap.get(c.id) || [],
      })),
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
      hasMore,
    };
  }

  /**
   * Update comment status (e.g., ACTIVE → RESOLVED)
   */
  async updateCommentStatus(companyId: string, commentId: string, dto: UpdateCommentStatusDto) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, companyId },
    });

    if (!comment) {
      return null;
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { status: dto.status },
    });
  }

  /**
   * Reply to an existing comment (creates a threaded child comment)
   */
  async replyToComment(companyId: string, commentId: string, authorId: string, authorName: string, dto: ReplyCommentDto) {
    // Verify parent exists
    const parent = await this.prisma.comment.findFirst({
      where: { id: commentId, companyId },
    });

    if (!parent) {
      return null;
    }

    const validMentions = await this.filterValidUserIds(dto.mentions || []);

    const reply = await this.prisma.comment.create({
      data: {
        companyId,
        entityType: parent.entityType,
        entityId: parent.entityId,
        authorId,
        authorName,
        content: dto.content,
        parentId: commentId,
        mentions: validMentions.length > 0 ? validMentions : undefined,
        attachments: dto.attachments && dto.attachments.length > 0 ? dto.attachments : undefined,
        status: 'ACTIVE',
      },
    });

    if (validMentions.length > 0) {
      await this.createMentionNotifications(companyId, validMentions, authorName, parent.entityType, parent.entityId);
    }

    return reply;
  }

  // ──────────────────────────────────────────────
  //  CLIENT TASKS
  // ──────────────────────────────────────────────

  /**
   * Auto-generate tasks based on client state.
   * Scans all clients (companies) for the same firm/group and generates tasks
   * for missing statements, unreconciled transactions, eTIMS failures, and inactivity.
   */
  async generateTasks(companyId: string) {
    let generatedCount = 0;

    // Get all clients under this company (if parent company, get children; else just this company)
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, parentCompanyId: true },
    });

    if (!company) {
      return { generatedCount: 0 };
    }

    // Determine the scope: if this is a parent/firm, scan all child companies
    // Otherwise, scan just this company
    const clientIds: string[] = [companyId];

    if (!company.parentCompanyId) {
      // This is likely a firm/parent — get all child companies
      const children = await this.prisma.company.findMany({
        where: { parentCompanyId: companyId, isActive: true },
        select: { id: true },
      });
      clientIds.push(...children.map((c) => c.id));
    }

    for (const clientId of clientIds) {
      await this.generateTasksForClient(companyId, clientId);
    }

    // Count how many were actually created by checking count before vs after
    const totalTasks = await this.prisma.clientTask.count({
      where: { companyId, status: 'PENDING' },
    });

    return { generatedCount: totalTasks };
  }

  private async generateTasksForClient(firmId: string, clientId: string) {
    // 1. Check for missing bank statements (last 3 months)
    const recentStatements = await this.prisma.statementUpload.findMany({
      where: {
        tenantId: clientId,
        createdAt: { gte: this.threeMonthsAgo() },
      },
    });

    const missingMonths = this.getMissingStatementMonths(recentStatements);
    for (const month of missingMonths) {
      await this.createTaskIfNotExists(firmId, clientId, {
        title: `Upload ${month} bank statements`,
        description: `Bank statements for ${month} have not been uploaded yet.`,
        category: 'UPLOAD_DOCUMENT',
        priority: 'MEDIUM',
        source: 'AUTO_GENERATED',
      });
    }

    // 2. Check for unreconciled transactions > 10
    const unreconciledMpesa = await this.prisma.mpesaTransaction.count({
      where: { companyId: clientId, isReconciled: false },
    });

    const unreconciledBank = await this.prisma.bankTransaction.count({
      where: { companyId: clientId, isReconciled: false },
    });

    const totalUnreconciled = unreconciledMpesa + unreconciledBank;
    if (totalUnreconciled > 10) {
      await this.createTaskIfNotExists(firmId, clientId, {
        title: `Approve ${totalUnreconciled} uncategorized transactions`,
        description: `There are ${totalUnreconciled} unreconciled transactions (${unreconciledMpesa} M-Pesa, ${unreconciledBank} bank) that need review.`,
        category: 'APPROVE_TRANSACTIONS',
        priority: totalUnreconciled > 50 ? 'HIGH' : 'MEDIUM',
        source: 'AUTO_GENERATED',
      });
    }

    // 3. Check for eTIMS failures > 5
    // ETIMSSubmission has no direct companyId — query through the invoice relation
    const failedEtimsSubmissions = await this.prisma.eTIMSSubmission.findMany({
      where: {
        status: 'FAILED',
        invoice: {
          companyId: clientId,
        },
      },
    });
    const etimsFailures = failedEtimsSubmissions.length;

    if (etimsFailures > 5) {
      const clientName = await this.getCompanyName(clientId);
      await this.createTaskIfNotExists(firmId, clientId, {
        title: `Review eTIMS failures for ${clientName}`,
        description: `${clientName} has ${etimsFailures} failed eTIMS submissions that need review and resubmission.`,
        category: 'SIGN_OFF',
        priority: 'HIGH',
        source: 'AUTO_GENERATED',
      });
    }

    // 4. Check for no activity in 30 days
    const recentActivity = await this.prisma.journalEntry.findFirst({
      where: {
        companyId: clientId,
        createdAt: { gte: this.thirtyDaysAgo() },
      },
    });

    if (!recentActivity) {
      const clientName = await this.getCompanyName(clientId);
      await this.createTaskIfNotExists(firmId, clientId, {
        title: `Follow up with ${clientName}`,
        description: `${clientName} has had no accounting activity in 30 days. Schedule a check-in.`,
        category: 'PROVIDE_INFO',
        priority: 'LOW',
        source: 'AUTO_GENERATED',
      });
    }
  }

  /**
   * Create a task only if no PENDING task already exists with the same category and clientId.
   * This prevents duplicate task generation.
   */
  private async createTaskIfNotExists(
    companyId: string,
    clientId: string,
    data: {
      title: string;
      description: string;
      category: string;
      priority: string;
      source: string;
    },
  ) {
    const existing = await this.prisma.clientTask.findFirst({
      where: {
        companyId,
        clientId,
        category: data.category,
        status: 'PENDING',
      },
    });

    if (existing) {
      return; // Skip — already have a PENDING task for this category/client
    }

    await this.prisma.clientTask.create({
      data: {
        companyId,
        clientId,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        status: 'PENDING',
        source: data.source,
      },
    });
  }

  /**
   * List tasks with optional filters and cursor-based pagination
   */
  async getTasks(companyId: string, query: QueryTasksDto) {
    const limit = parseInt(query.limit || '50', 10);
    const take = Math.min(Math.max(limit, 1), 100);

    const where: any = { companyId };

    if (query.clientId) {
      where.clientId = query.clientId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.cursor) {
      const cursorTask = await this.prisma.clientTask.findUnique({
        where: { id: query.cursor },
        select: { createdAt: true },
      });
      if (cursorTask) {
        where.createdAt = { lt: cursorTask.createdAt };
      }
    }

    const tasks = await this.prisma.clientTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });

    const hasMore = tasks.length > take;
    const items = hasMore ? tasks.slice(0, take) : tasks;

    return {
      data: items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
      hasMore,
    };
  }

  /**
   * Update a task (status, assignee)
   */
  async updateTask(companyId: string, taskId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.clientTask.findFirst({
      where: { id: taskId, companyId },
    });

    if (!task) {
      return null;
    }

    const updateData: any = {};
    if (dto.status) {
      updateData.status = dto.status;
      if (dto.status === 'COMPLETED') {
        updateData.completedAt = new Date(); // Only for completion timestamp, not financial logic
      }
    }
    if (dto.assignedToId !== undefined) {
      updateData.assignedToId = dto.assignedToId;
    }
    if (dto.assignedToName !== undefined) {
      updateData.assignedToName = dto.assignedToName;
    }

    return this.prisma.clientTask.update({
      where: { id: taskId },
      data: updateData,
    });
  }

  /**
   * Escalate a task (increments escalationCount)
   */
  async escalateTask(companyId: string, taskId: string) {
    const task = await this.prisma.clientTask.findFirst({
      where: { id: taskId, companyId },
    });

    if (!task) {
      return null;
    }

    return this.prisma.clientTask.update({
      where: { id: taskId },
      data: {
        escalationCount: { increment: 1 },
        status: 'ESCALATED',
        priority: task.priority === 'LOW' ? 'MEDIUM' : task.priority === 'MEDIUM' ? 'HIGH' : 'URGENT',
      },
    });
  }

  // ──────────────────────────────────────────────
  //  NOTIFICATIONS
  // ──────────────────────────────────────────────

  /**
   * Get the count of unread notifications for a user.
   * Uses readAt IS NULL to determine unread status.
   * Edge case: zero unread → returns { count: 0 }, not 404.
   */
  async getUnreadCount(companyId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { companyId, userId, readAt: null },
    });
    return { count };
  }

  /**
   * Create a notification.
   * Created even if the user is deleted — they'll see it on next login.
   */
  async createNotification(companyId: string, dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        companyId,
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message || null,
        link: dto.link || null,
        channel: dto.channel || 'IN_APP',
        relatedEntityType: dto.relatedEntityType || null,
        relatedEntityId: dto.relatedEntityId || null,
        status: 'UNREAD',
        sentAt: new Date(), // Display timestamp — not financial logic
      },
    });
  }

  /**
   * List notifications for a user with optional filters
   */
  async getNotifications(companyId: string, query: QueryNotificationsDto) {
    const limit = parseInt(query.limit || '50', 10);
    const take = Math.min(Math.max(limit, 1), 100);

    const where: any = {
      companyId,
      userId: query.userId,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.cursor) {
      const cursorNotification = await this.prisma.notification.findUnique({
        where: { id: query.cursor },
        select: { createdAt: true },
      });
      if (cursorNotification) {
        where.createdAt = { lt: cursorNotification.createdAt };
      }
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });

    const hasMore = notifications.length > take;
    const items = hasMore ? notifications.slice(0, take) : notifications;

    const unreadCount = await this.prisma.notification.count({
      where: { companyId, userId: query.userId, status: 'UNREAD' },
    });

    return {
      data: items,
      unreadCount,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
      hasMore,
    };
  }

  /**
   * Mark a single notification as read
   */
  async markNotificationRead(companyId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, companyId },
    });

    if (!notification) {
      return null;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'READ',
        readAt: new Date(), // Display timestamp — not financial logic
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsRead(companyId: string, dto: MarkAllReadDto) {
    const result = await this.prisma.notification.updateMany({
      where: {
        companyId,
        userId: dto.userId,
        status: 'UNREAD',
      },
      data: {
        status: 'READ',
        readAt: new Date(), // Display timestamp — not financial logic
      },
    });

    return { updatedCount: result.count };
  }

  // ──────────────────────────────────────────────
  //  HELPERS
  // ──────────────────────────────────────────────

  /**
   * Filter mention user IDs to only include users that actually exist.
   * Silently ignores invalid/deleted user IDs.
   */
  private async filterValidUserIds(mentions: string[]): Promise<string[]> {
    if (mentions.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: mentions }, isActive: true },
      select: { id: true },
    });

    const validIds = new Set(users.map((u) => u.id));
    return mentions.filter((id) => validIds.has(id));
  }

  /**
   * Create COMMENT_MENTION notifications for mentioned users
   */
  private async createMentionNotifications(
    companyId: string,
    mentionedUserIds: string[],
    authorName: string,
    entityType: string,
    entityId: string,
  ) {
    for (const userId of mentionedUserIds) {
      await this.prisma.notification.create({
        data: {
          companyId,
          userId,
          type: 'COMMENT_MENTION',
          title: `${authorName} mentioned you`,
          message: `${authorName} mentioned you in a comment on ${entityType} ${entityId}`,
          link: `/${entityType.toLowerCase()}?id=${entityId}`,
          channel: 'IN_APP',
          relatedEntityType: entityType,
          relatedEntityId: entityId,
          status: 'UNREAD',
          sentAt: new Date(), // Display timestamp — not financial logic
        },
      });
    }
  }

  private async getCompanyName(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    return company?.name || 'Unknown Client';
  }

  /**
   * Get a date for cursor-based pagination.
   * Uses createdAt field for ordering since it's indexed.
   */
  private async getCursorDate(cursorId: string): Promise<Date> {
    const item = await this.prisma.comment.findUnique({
      where: { id: cursorId },
      select: { createdAt: true },
    });
    return item?.createdAt || new Date(0);
  }

  /**
   * Get a date 3 months ago for comparison (non-financial)
   */
  private threeMonthsAgo(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d;
  }

  /**
   * Get a date 30 days ago for comparison (non-financial)
   */
  private thirtyDaysAgo(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }

  /**
   * Calculate missing statement months for the last 3 months
   */
  private getMissingStatementMonths(statements: { createdAt: Date }[]): string[] {
    const months: string[] = [];
    const now = new Date();

    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleString('default', { month: 'long', year: 'numeric' });

      const hasStatement = statements.some((s) => {
        const sMonth = s.createdAt.getMonth();
        const sYear = s.createdAt.getFullYear();
        return sMonth === d.getMonth() && sYear === d.getFullYear();
      });

      if (!hasStatement) {
        months.push(monthStr);
      }
    }

    return months;
  }
}
