import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeatureGuard } from './feature.guard';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * GET /api/v1/billing/plans
   * List all pricing plans with features. No auth required.
   */
  @Get('plans')
  getPlans() {
    return this.billingService.getPlans();
  }

  /**
   * GET /api/v1/billing/subscription?companyId=comp_123
   * Get the current subscription for a company. Requires JWT auth.
   */
  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  getSubscription(@Req() req: any, @Query('companyId') companyId: string) {
    const id = companyId || req.user?.companyId;
    return this.billingService.getSubscription(id);
  }

  /**
   * POST /api/v1/billing/subscription
   * Create or update a subscription. Requires JWT auth.
   * Body: { companyId, tier }
   */
  @Post('subscription')
  @UseGuards(JwtAuthGuard)
  createSubscription(
    @Req() req: any,
    @Body() body: { companyId: string; tier: string },
  ) {
    const companyId = body.companyId || req.user?.companyId;
    return this.billingService.createSubscription(companyId, body.tier);
  }

  /**
   * PATCH /api/v1/billing/subscription/tier
   * Change subscription tier (mid-cycle, immediate effect). Requires JWT auth.
   * Body: { companyId, tier }
   */
  @Patch('subscription/tier')
  @UseGuards(JwtAuthGuard)
  changeTier(
    @Req() req: any,
    @Body() body: { companyId: string; tier: string },
  ) {
    const companyId = body.companyId || req.user?.companyId;
    return this.billingService.changeTier(companyId, body.tier);
  }

  /**
   * POST /api/v1/billing/subscription/cancel
   * Cancel a subscription. Remains active until period end. Requires JWT auth.
   * Body: { companyId }
   */
  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard)
  cancelSubscription(
    @Req() req: any,
    @Body() body: { companyId: string },
  ) {
    const companyId = body.companyId || req.user?.companyId;
    return this.billingService.cancelSubscription(companyId);
  }
}
