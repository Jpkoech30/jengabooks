import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  NotFoundException,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import * as fs from 'fs';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * POST /api/v1/documents/upload
   * Upload a document (multipart)
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const uploadedById = req.user.sub || req.user.userId;
    return this.documentsService.uploadDocument(file, dto, uploadedById);
  }

  /**
   * GET /api/v1/documents?companyId=comp_123&category=BANK_STATEMENT
   * List documents (paginated, filterable)
   */
  @Get()
  async listDocuments(@Req() req: any, @Query() query: QueryDocumentsDto) {
    return this.documentsService.listDocuments(query);
  }

  /**
   * GET /api/v1/documents/:id
   * Get document metadata
   */
  @Get(':id')
  async getDocument(@Req() req: any, @Param('id') id: string) {
    const result = await this.documentsService.getDocument(id);
    if (!result) {
      throw new NotFoundException('Document not found');
    }
    return result;
  }

  /**
   * GET /api/v1/documents/:id/download?version=2
   * Download file (streams the binary)
   */
  @Get(':id/download')
  @Header('Content-Disposition', 'attachment')
  async downloadDocument(
    @Req() req: any,
    @Res() res: Response,
    @Param('id') id: string,
    @Query('version') version?: string,
  ) {
    const versionNum = version ? parseInt(version, 10) : undefined;
    const result = await this.documentsService.downloadDocument(id, versionNum);
    if (!result) {
      throw new NotFoundException('Document or version not found');
    }

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', result.fileSize);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.originalName}"`,
    );

    const readStream = fs.createReadStream(result.filePath);
    readStream.pipe(res);
  }

  /**
   * PATCH /api/v1/documents/:id
   * Update metadata (description, tags, category)
   */
  @Patch(':id')
  async updateDocument(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    const companyId = req.user.companyId;
    const result = await this.documentsService.updateDocument(id, companyId, dto);
    if (!result) {
      throw new NotFoundException('Document not found');
    }
    return result;
  }

  /**
   * DELETE /api/v1/documents/:id
   * Soft-delete document
   */
  @Delete(':id')
  @HttpCode(200)
  async deleteDocument(@Req() req: any, @Param('id') id: string) {
    const companyId = req.user.companyId;
    const result = await this.documentsService.deleteDocument(id, companyId);
    if (!result) {
      throw new NotFoundException('Document not found');
    }
    return result;
  }

  /**
   * POST /api/v1/documents/:id/versions
   * Upload new version of existing document
   */
  @Post(':id/versions')
  @UseInterceptors(FileInterceptor('file'))
  async uploadNewVersion(
    @Req() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const uploadedById = req.user.sub || req.user.userId;
    const result = await this.documentsService.uploadNewVersion(id, file, uploadedById);
    if (!result) {
      throw new NotFoundException('Document not found');
    }
    return result;
  }

  /**
   * GET /api/v1/documents/:id/versions
   * List all versions
   */
  @Get(':id/versions')
  async listVersions(@Req() req: any, @Param('id') id: string) {
    const result = await this.documentsService.listVersions(id);
    if (!result) {
      throw new NotFoundException('Document not found');
    }
    return result;
  }
}
