import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tenantsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 100) : 20,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post()
  create(@Body() body: { name: string; tier?: string; kraPin?: string }) {
    return this.tenantsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; kraPin?: string; tier?: string }) {
    return this.tenantsService.update(id, body);
  }

  @Get(':companyId/members')
  getMembers(@Param('companyId') companyId: string) {
    return this.tenantsService.getMembers(companyId);
  }

  @Post(':companyId/members')
  addMember(@Param('companyId') companyId: string, @Body() body: { userId: string; role: string }) {
    return this.tenantsService.addMember(companyId, body);
  }

  @Post(':companyId/members/invite')
  inviteMember(@Param('companyId') companyId: string, @Body() body: { email: string; role: string; name?: string }) {
    return this.tenantsService.inviteByEmail(companyId, body);
  }

  @Patch(':companyId/members/:userId')
  updateMemberRole(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
    @Body() body: { role: string },
  ) {
    return this.tenantsService.updateMemberRole(companyId, userId, body.role);
  }

  @Delete(':companyId/members/:userId')
  removeMember(@Param('companyId') companyId: string, @Param('userId') userId: string) {
    return this.tenantsService.removeMember(companyId, userId);
  }
}
