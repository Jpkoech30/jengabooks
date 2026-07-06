import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { HealthScoreService } from './health-score.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('health-score')
@UseGuards(JwtAuthGuard)
export class HealthScoreController {
  constructor(private readonly healthScoreService: HealthScoreService) {}

  @Get()
  getHealthScore(@Req() req: any) {
    return this.healthScoreService.getHealthScore(req.user.companyId);
  }
}
