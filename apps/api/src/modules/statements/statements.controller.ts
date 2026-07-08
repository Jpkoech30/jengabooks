import {
  Controller, Post, Get, Param, Query, Req, Body,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatementsService } from './statements.service';
import { UploadStatementDto, ListUploadsQueryDto } from './dto/upload-statement.dto';

@Controller('statements')
@UseGuards(JwtAuthGuard)
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  /**
   * POST /api/v1/statements/upload
   *
   * Upload a bank/M-Pesa statement for processing.
   * Accepts multipart/form-data with:
   *   - file (required): PDF, CSV, or XLSX
   *   - institution (optional): Override auto-detection
   *
   * Returns immediately with the upload ID and status.
   * Processing happens asynchronously via BullMQ.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadStatement(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadStatementDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required. Use multipart/form-data with field name "file".');
    }

    return this.statementsService.uploadStatement(
      req.user.companyId,
      req.user.userId,
      file,
      dto.institution,
    );
  }

  /**
   * GET /api/v1/statements/:uploadId
   *
   * Get the status and details of a specific statement upload.
   */
  @Get(':uploadId')
  async getUpload(
    @Req() req: any,
    @Param('uploadId') uploadId: string,
  ) {
    return this.statementsService.getUpload(req.user.companyId, uploadId);
  }

  /**
   * GET /api/v1/statements
   *
   * List all statement uploads for the current tenant.
   * Supports filtering by status, institution, and pagination.
   */
  @Get()
  async listUploads(
    @Req() req: any,
    @Query() query: ListUploadsQueryDto,
  ) {
    return this.statementsService.listUploads(req.user.companyId, {
      status: query.status,
      institution: query.institution,
      page: query.page,
      limit: query.limit,
    });
  }
}
