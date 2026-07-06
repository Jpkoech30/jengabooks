import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { WizardService } from './wizard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('wizard')
@UseGuards(JwtAuthGuard)
export class WizardController {
  constructor(private readonly wizardService: WizardService) {}

  @Get('progress')
  getProgress(@Req() req: any) {
    return this.wizardService.getProgress(req.user.userId, req.user.companyId);
  }

  @Post('complete-step')
  completeStep(
    @Req() req: any,
    @Body() body: { step: string },
  ) {
    return this.wizardService.completeStep(req.user.userId, req.user.companyId, body.step);
  }

  @Post('auto-detect')
  autoDetect(@Req() req: any) {
    return this.wizardService.autoDetectProgress(req.user.userId, req.user.companyId);
  }
}
