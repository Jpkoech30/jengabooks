import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('profile')
  getProfile(@Req() req: any) {
    return this.gamificationService.getProfile(req.user.userId, req.user.companyId);
  }

  @Get('badges')
  getBadges(@Req() req: any) {
    return this.gamificationService.getBadges(req.user.userId, req.user.companyId);
  }

  @Get('leaderboard')
  getLeaderboard(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    return this.gamificationService.getLeaderboard(
      req.user.companyId,
      limit ? parseInt(limit, 10) : 10,
    );
  }
}
