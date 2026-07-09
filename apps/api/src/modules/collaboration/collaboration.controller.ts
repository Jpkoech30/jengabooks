import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { CollaborationService } from './collaboration.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReplyCommentDto } from './dto/reply-comment.dto';
import { UpdateCommentStatusDto } from './dto/update-comment-status.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { MarkAllReadDto } from './dto/mark-all-read.dto';

@Controller('collab')
@UseGuards(JwtAuthGuard)
export class CollaborationController {
  constructor(private readonly collabService: CollaborationService) {}

  // ──────────────────────────────────────────────
  //  COMMENTS
  // ──────────────────────────────────────────────

  /**
   * POST /api/v1/collab/comments
   * Create a comment on a transaction
   */
  @Post('comments')
  async createComment(@Req() req: any, @Body() dto: CreateCommentDto) {
    const companyId = req.user.companyId;
    const authorId = req.user.sub || req.user.userId;
    const authorName = req.user.email?.split('@')[0] || 'User';
    return this.collabService.createComment(companyId, authorId, authorName, dto);
  }

  /**
   * GET /api/v1/collab/comments?entityType=MPESA_TX&entityId=tx_123
   * Get comments for an entity
   */
  @Get('comments')
  async getComments(@Req() req: any, @Query() query: QueryCommentsDto) {
    const companyId = req.user.companyId;
    return this.collabService.getComments(companyId, query);
  }

  /**
   * PATCH /api/v1/collab/comments/:id/status
   * Update comment status (ACTIVE → RESOLVED)
   */
  @Patch('comments/:id/status')
  async updateCommentStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCommentStatusDto,
  ) {
    const companyId = req.user.companyId;
    const result = await this.collabService.updateCommentStatus(companyId, id, dto);
    if (!result) {
      throw new NotFoundException('Comment not found');
    }
    return result;
  }

  /**
   * POST /api/v1/collab/comments/:id/reply
   * Reply to a comment (sets parentId)
   */
  @Post('comments/:id/reply')
  async replyToComment(@Req() req: any, @Param('id') id: string, @Body() dto: ReplyCommentDto) {
    const companyId = req.user.companyId;
    const authorId = req.user.sub || req.user.userId;
    const authorName = req.user.email?.split('@')[0] || 'User';
    const result = await this.collabService.replyToComment(companyId, id, authorId, authorName, dto);
    if (!result) {
      throw new NotFoundException('Parent comment not found');
    }
    return result;
  }

  // ──────────────────────────────────────────────
  //  CLIENT TASKS
  // ──────────────────────────────────────────────

  /**
   * POST /api/v1/collab/tasks/generate
   * Auto-generate tasks based on client state
   */
  @Post('tasks/generate')
  async generateTasks(@Req() req: any) {
    const companyId = req.user.companyId;
    return this.collabService.generateTasks(companyId);
  }

  /**
   * GET /api/v1/collab/tasks?clientId=comp_123&status=PENDING
   * List tasks
   */
  @Get('tasks')
  async getTasks(@Req() req: any, @Query() query: QueryTasksDto) {
    const companyId = req.user.companyId;
    return this.collabService.getTasks(companyId, query);
  }

  /**
   * PATCH /api/v1/collab/tasks/:id
   * Update task (status, assignee)
   */
  @Patch('tasks/:id')
  async updateTask(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    const companyId = req.user.companyId;
    const result = await this.collabService.updateTask(companyId, id, dto);
    if (!result) {
      throw new NotFoundException('Task not found');
    }
    return result;
  }

  /**
   * POST /api/v1/collab/tasks/:id/escalate
   * Escalate task (increments escalationCount)
   */
  @Post('tasks/:id/escalate')
  @HttpCode(200)
  async escalateTask(@Req() req: any, @Param('id') id: string) {
    const companyId = req.user.companyId;
    const result = await this.collabService.escalateTask(companyId, id);
    if (!result) {
      throw new NotFoundException('Task not found');
    }
    return result;
  }

  // ──────────────────────────────────────────────
  //  NOTIFICATIONS
  // ──────────────────────────────────────────────

  /**
   * POST /api/v1/collab/notifications
   * Create a notification
   */
  @Post('notifications')
  async createNotification(@Req() req: any, @Body() dto: CreateNotificationDto) {
    const companyId = req.user.companyId;
    return this.collabService.createNotification(companyId, dto);
  }

  /**
   * GET /api/v1/collab/notifications/count?userId=me
   * Get unread notification count for a user.
   * Returns { count: number } — zero allowed, not 404.
   */
  @Get('notifications/count')
  async getUnreadCount(@Req() req: any, @Query('userId') userId: string) {
    const companyId = req.user.companyId;
    const targetUserId = userId === 'me' ? req.user.sub || req.user.userId : userId;
    return this.collabService.getUnreadCount(companyId, targetUserId);
  }

  /**
   * GET /api/v1/collab/notifications?userId=user_456&status=UNREAD
   * List notifications
   */
  @Get('notifications')
  async getNotifications(@Req() req: any, @Query() query: QueryNotificationsDto) {
    const companyId = req.user.companyId;
    return this.collabService.getNotifications(companyId, query);
  }

  /**
   * PATCH /api/v1/collab/notifications/:id/read
   * Mark a single notification as read
   */
  @Patch('notifications/:id/read')
  async markNotificationRead(@Req() req: any, @Param('id') id: string) {
    const companyId = req.user.companyId;
    const result = await this.collabService.markNotificationRead(companyId, id);
    if (!result) {
      throw new NotFoundException('Notification not found');
    }
    return result;
  }

  /**
   * POST /api/v1/collab/notifications/mark-all-read
   * Mark all notifications as read for a user
   */
  @Post('notifications/mark-all-read')
  @HttpCode(200)
  async markAllNotificationsRead(@Req() req: any, @Body() dto: MarkAllReadDto) {
    const companyId = req.user.companyId;
    return this.collabService.markAllNotificationsRead(companyId, dto);
  }
}
