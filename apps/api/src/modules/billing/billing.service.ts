import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Hardcoded pricing tiers for JengaBooks.
 * All prices in KES (Kenyan Shillings).
 */
const PRICING_TIERS = {
  STARTER: { name: 'Starter', price: 2500, features: ['Basic bookkeeping', 'Invoicing', 'eTIMS compliance'] },
  PRO: { name: 'Pro', price: 5000, features: ['M-Pesa integration', 'Payroll', 'Bank feeds', 'Client portal'] },
  ENTERPRISE: { name: 'Enterprise', price: 12000, features: ['Multi-entity', 'Multi-currency', 'Advanced reporting', 'White-label', 'Priority support'] },
  ACCOUNTANT_PRACTICE: { name: 'Accountant Practice', price: 15000, features: ['Up to 50 clients', 'All features', 'Bulk actions', 'Practice dashboard'] },
} as const;

type TierKey = keyof typeof PRICING_TIERS;

/**
 * Maps tier keys to their feature arrays for O(1) feature lookups.
 */
const TIER_FEATURES_MAP: Record<TierKey, readonly string[]> = {
  STARTER: PRICING_TIERS.STARTER.features,
  PRO: PRICING_TIERS.PRO.features,
  ENTERPRISE: PRICING_TIERS.ENTERPRISE.features,
  ACCOUNTANT_PRACTICE: PRICING_TIERS.ACCOUNTANT_PRACTICE.features,
};

const VALID_TIERS = Object.keys(PRICING_TIERS);

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Returns all pricing tiers with their features.
   * No auth required — transparent pricing display.
   */
  getPlans() {
    return PRICING_TIERS;
  }

  /**
   * Returns the current subscription for a company.
   * If no subscription exists, auto-creates a TRIAL subscription.
   * If trial has expired (trialEndsAt < now and status TRIAL), transitions to EXPIRED.
   *
   * Edge cases:
   * - Company with no subscription → auto-create TRIAL on first access
   * - Trial expired → status becomes EXPIRED
   * - Resolves tier features from TIER_FEATURES_MAP
   */
  async getSubscription(companyId: string) {
    let subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
    });

    if (!subscription) {
      this.logger.log(`No subscription found for company ${companyId} — auto-creating TRIAL`);
      subscription = await this.getOrCreateSubscription(companyId);
    }

    // Check if trial has expired
    if (
      subscription.status === 'TRIAL' &&
      subscription.trialEndsAt &&
      new Date(subscription.trialEndsAt) < (await this.getDbNow())
    ) {
      this.logger.log(`Trial expired for company ${companyId} — setting status to EXPIRED`);
      subscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' },
      });
    }

    return this.enrichSubscription(subscription);
  }

  /**
   * Creates a new ACTIVE subscription or updates an existing one.
   * Sets trialEndsAt to null (no trial for direct creation).
   * Validates the tier exists in PRICING_TIERS.
   */
  async createSubscription(companyId: string, tier: string) {
    this.validateTier(tier);

    // Use DB time for period calculations (TIME-TRAVEL compliance)
    const dbNow = await this.getDbNow();
    const currentPeriodEnd = new Date(dbNow.getTime() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.subscription.upsert({
      where: { companyId },
      update: {
        tier,
        status: 'ACTIVE',
        currentPeriodStart: dbNow,
        currentPeriodEnd,
        trialEndsAt: null,
        cancelledAt: null,
      },
      create: {
        companyId,
        tier,
        status: 'ACTIVE',
        currentPeriodStart: dbNow,
        currentPeriodEnd,
      },
    });

    this.logger.log(`Subscription created/updated for company ${companyId}: tier=${tier}, status=ACTIVE`);
    return this.getSubscription(companyId);
  }

  /**
   * Changes the tier of an existing subscription (mid-cycle, immediate effect).
   * No proration in this simple model.
   * Validates the new tier exists in PRICING_TIERS.
   */
  async changeTier(companyId: string, newTier: string) {
    this.validateTier(newTier);

    const existing = await this.prisma.subscription.findUnique({ where: { companyId } });
    if (!existing) {
      throw new NotFoundException(`No subscription found for company ${companyId}`);
    }

    await this.prisma.subscription.update({
      where: { companyId },
      data: { tier: newTier },
    });

    this.logger.log(`Tier changed for company ${companyId}: ${existing.tier} → ${newTier}`);
    return this.getSubscription(companyId);
  }

  /**
   * Cancels a subscription. Sets status to CANCELLED and records cancelledAt.
   * The subscription remains active until the end of the current period.
   */
  async cancelSubscription(companyId: string) {
    const existing = await this.prisma.subscription.findUnique({ where: { companyId } });
    if (!existing) {
      throw new NotFoundException(`No subscription found for company ${companyId}`);
    }

    const dbNow = await this.getDbNow();
    await this.prisma.subscription.update({
      where: { companyId },
      data: {
        status: 'CANCELLED',
        cancelledAt: dbNow,
      },
    });

    this.logger.log(`Subscription cancelled for company ${companyId}`);
    return this.getSubscription(companyId);
  }

  /**
   * Checks whether a company's subscription includes a required feature.
   * Used by the FeatureGuard to gate protected routes.
   * If no subscription exists, auto-creates a TRIAL and checks against it.
   */
  async getFeatureCheck(companyId: string, requiredFeature: string): Promise<boolean> {
    let subscription = await this.prisma.subscription.findUnique({ where: { companyId } });

    if (!subscription) {
      subscription = await this.getOrCreateSubscription(companyId);
    }

    const tier = subscription.tier as TierKey;
    const features = TIER_FEATURES_MAP[tier] || [];
    return features.includes(requiredFeature);
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────

  /**
   * Gets the current database timestamp for TIME-TRAVEL compliant period calculations.
   * All financial period markers derive from this single DB-source of truth.
   */
  private async getDbNow(): Promise<Date> {
    const result = await this.prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
    return result[0].now;
  }

  /**
   * Auto-creates a TRIAL subscription for a company on first access.
   * Uses DB timestamp for period calculations (TIME-TRAVEL compliant).
   * trialEndsAt = dbNow + 14 days
   * currentPeriodEnd = dbNow + 30 days
   */
  private async getOrCreateSubscription(companyId: string) {
    const dbNow = await this.getDbNow();
    const trialEndsAt = new Date(dbNow.getTime() + 14 * 24 * 60 * 60 * 1000);
    const currentPeriodEnd = new Date(dbNow.getTime() + 30 * 24 * 60 * 60 * 1000);

    return this.prisma.subscription.create({
      data: {
        companyId,
        tier: 'STARTER',
        status: 'TRIAL',
        trialEndsAt,
        currentPeriodStart: dbNow,
        currentPeriodEnd,
      },
    });
  }

  /**
   * Validates that a tier string is one of the known pricing tiers.
   * Throws BadRequestException if invalid.
   */
  private validateTier(tier: string): asserts tier is TierKey {
    if (!VALID_TIERS.includes(tier)) {
      throw new BadRequestException(
        `Invalid tier "${tier}". Valid tiers: ${VALID_TIERS.join(', ')}`,
      );
    }
  }

  /**
   * Enriches a raw subscription record with resolved features and pricing info.
   */
  private enrichSubscription(subscription: {
    companyId: string;
    tier: string;
    status: string;
    trialEndsAt: Date | null;
    currentPeriodStart: Date;
    currentPeriodEnd: Date | null;
  }) {
    const tier = subscription.tier as TierKey;
    const pricingInfo = PRICING_TIERS[tier] || PRICING_TIERS.STARTER;

    return {
      companyId: subscription.companyId,
      tier: subscription.tier,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      features: TIER_FEATURES_MAP[tier] || [],
      price: pricingInfo.price,
    };
  }
}
