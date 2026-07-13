import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { RecurringJournalService, RecurringJournalTemplateData } from './recurring-journal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('recurring-journal')
@UseGuards(JwtAuthGuard)
export class RecurringJournalController {
    constructor(private readonly service: RecurringJournalService) { }

    @Post()
    create(@Req() req: any, @Body() body: RecurringJournalTemplateData) {
        body.companyId = req.user.companyId;
        body.createdById = req.user.userId;
        return this.service.create(body);
    }

    @Get()
    findAll(@Req() req: any, @Query('includeInactive') includeInactive?: string) {
        return this.service.findAll(req.user.companyId, includeInactive === 'true');
    }

    @Get('due')
    getDue(@Req() req: any) {
        return this.service.processDueTemplates(req.user.companyId);
    }

    @Get(':id')
    findOne(@Req() req: any, @Param('id') id: string) {
        return this.service.findOne(id, req.user.companyId);
    }

    @Put(':id')
    update(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: Partial<RecurringJournalTemplateData>,
    ) {
        return this.service.update(id, req.user.companyId, body);
    }

    @Delete(':id')
    remove(@Req() req: any, @Param('id') id: string) {
        return this.service.remove(id, req.user.companyId);
    }
}
