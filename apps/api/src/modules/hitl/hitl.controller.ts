import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { HitlService } from './hitl.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('hitl')
@UseGuards(JwtAuthGuard)
export class HitlController {
  constructor(private readonly hitlService: HitlService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.hitlService.findAll(req.user.companyId);
  }

  @Post()
  create(@Req() req: any, @Body() body: {
    category: string;
    description: string;
    rawData?: string;
    conflictData?: string;
    linkedEntityId?: string;
    linkedEntityType?: string;
    confidence?: number;
  }) {
    return this.hitlService.create(req.user.companyId, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hitlService.findOne(id);
  }

  @Post(':id/assign')
  assign(@Req() req: any, @Param('id') id: string) {
    // Use the authenticated user's ID from JWT instead of requiring it from the body
    return this.hitlService.assign(id, req.user.userId);
  }

  @Post(':id/resolve')
  resolve(@Req() req: any, @Param('id') id: string, @Body() body: {
    resolution: string;
    action: 'APPROVE' | 'REJECT' | 'EDIT';
    correctedData?: string;
    xpAwarded?: number;
  }) {
    return this.hitlService.resolve(id, req.user.userId, body.resolution, body.action || 'APPROVE', body.correctedData, body.xpAwarded);
  }
}
