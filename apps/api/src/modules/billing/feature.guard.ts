import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BillingService } from './billing.service';

export const REQUIRED_FEATURE_KEY = 'requiredFeature';

/**
 * FeatureGuard checks whether the requesting company's subscription
 * includes a required feature (set via @SetMetadata('requiredFeature', ...)).
 *
 * If the feature is not in the company's plan, the guard throws a 402 Payment Required
 * response with a descriptive message.
 *
 * Usage:
 * ```typescript
 * @SetMetadata('requiredFeature', 'M-Pesa integration')
 * @UseGuards(FeatureGuard)
 * @Post('mpesa/transaction')
 * ```
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billingService: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      REQUIRED_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No feature required — allow access
    if (!requiredFeature) {
      return true;
    }

    const request = this.getRequest(context);
    const companyId = request.body?.companyId || request.query?.companyId || request.user?.companyId;

    if (!companyId) {
      throw new HttpException(
        'Company identifier is required for feature access check',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hasFeature = await this.billingService.getFeatureCheck(companyId, requiredFeature);

    if (!hasFeature) {
      throw new HttpException(
        `Your current subscription plan does not include "${requiredFeature}". Please upgrade your plan to access this feature.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }

  /**
   * Extract the request object from the execution context.
   * Supports HTTP and GraphQL contexts.
   */
  private getRequest(context: ExecutionContext): any {
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest();
    }
    // GraphQL context support
    const ctx = context as any;
    return ctx.getArgs?.()?.req || ctx.getContext?.()?.req;
  }
}
