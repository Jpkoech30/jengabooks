import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { PracticeService } from './practice.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('practice')
@UseGuards(JwtAuthGuard)
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  /**
   * GET /api/v1/practice/portfolio
   * Returns a list of all clients for a firm user with health metrics.
   */
  @Get('portfolio')
  getPortfolio(@Req() req: any) {
    return this.practiceService.getPortfolio(req.user.userId);
  }

  /**
   * GET /api/v1/practice/portfolio/:clientId
   * Returns detailed health breakdown for a single client.
   */
  @Get('portfolio/:clientId')
  getClientDetail(@Param('clientId') clientId: string) {
    return this.practiceService.getClientDetail(clientId);
  }
}
