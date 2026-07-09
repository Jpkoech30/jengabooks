import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SandboxService, InitSandboxDto, ResetSandboxDto } from './sandbox.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sandbox')
@UseGuards(JwtAuthGuard)
export class SandboxController {
  constructor(private readonly sandboxService: SandboxService) {}

  /**
   * POST /api/v1/sandbox/init
   * Initialize sandbox with realistic Kenyan SME sample data.
   * Edge case: if user already has a sandbox, returns existing.
   */
  @Post('init')
  init(
    @Req() req: any,
    @Body() dto: InitSandboxDto,
  ) {
    return this.sandboxService.init(dto, req.user.userId);
  }

  /**
   * POST /api/v1/sandbox/reset
   * Delete all sandbox data and re-run init.
   * Requires valid resetToken (prevents accidental reset).
   */
  @Post('reset')
  reset(
    @Req() req: any,
    @Body() dto: ResetSandboxDto,
  ) {
    return this.sandboxService.reset(dto);
  }

  /**
   * GET /api/v1/sandbox/status
   * Check if current user's company is a sandbox.
   */
  @Get('status')
  status(@Req() req: any) {
    return this.sandboxService.status(req.user.companyId);
  }
}
