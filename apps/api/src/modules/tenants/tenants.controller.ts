import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query, Req } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Enforce tenant isolation: users can only see companies they belong to
    // SUPER_ADMIN can see all companies
    return this.tenantsService.findAll(
      req.user.userId,
      req.user.role,
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
