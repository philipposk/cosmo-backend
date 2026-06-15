import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { RequestCheckoutSessionDto } from './dto/request-checkout-session.dto';

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);
  private readonly defaultSuccessUrl: string;
  private readonly defaultCancelUrl: string;
  private readonly defaultPortalReturnUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {
    this.defaultSuccessUrl =
      this.configService.get<string>('STRIPE_CHECKOUT_SUCCESS_URL') ??
      'http://localhost:3000/membership?status=success';
    this.defaultCancelUrl =
      this.configService.get<string>('STRIPE_CHECKOUT_CANCEL_URL') ??
      'http://localhost:3000/membership?status=cancelled';
    this.defaultPortalReturnUrl =
      this.configService.get<string>('STRIPE_PORTAL_RETURN_URL') ??
      'http://localhost:3000/membership';
  }

  listTiers() {
    return this.prisma.membershipTier.findMany({
      orderBy: {
        priorityLevel: 'desc',
      },
    });
  }

  getUserMembership(userId: string) {
    return this.prisma.userMembership.findUnique({
      where: { userId },
      include: {
        tier: true,
      },
    });
  }

  async createCheckoutSession(userId: string, dto: RequestCheckoutSessionDto) {
    const tier = await this.prisma.membershipTier.findUnique({
      where: { slug: dto.tierSlug },
    });

    if (!tier || !tier.stripePriceId) {
      throw new Error(
        'Requested membership tier is not available for checkout',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.email) {
      throw new Error('User email is required to create a checkout session');
    }

    const session = await this.stripeService.createCheckoutSession({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [
        {
          price: tier.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        tierId: tier.id,
      },
      subscription_data: {
        metadata: {
          userId,
          tierId: tier.id,
        },
      },
      success_url: dto.successUrl ?? this.defaultSuccessUrl,
      cancel_url: dto.cancelUrl ?? this.defaultCancelUrl,
      allow_promotion_codes: true,
    });

    return session;
  }

  async upsertMembershipFromStripe(payload: {
    userId: string;
    tierId: string;
    customerId: string;
    subscriptionId: string;
    status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
    currentPeriodEnd: Date | null;
  }) {
    this.logger.log(
      `Upserting membership for user ${payload.userId} to tier ${payload.tierId}`,
    );
    await this.prisma.userMembership.upsert({
      where: { userId: payload.userId },
      update: {
        tierId: payload.tierId,
        status: payload.status,
        stripeCustomerId: payload.customerId,
        stripeSubscriptionId: payload.subscriptionId,
        currentPeriodEnd: payload.currentPeriodEnd,
      },
      create: {
        userId: payload.userId,
        tierId: payload.tierId,
        status: payload.status,
        stripeCustomerId: payload.customerId,
        stripeSubscriptionId: payload.subscriptionId,
        currentPeriodEnd: payload.currentPeriodEnd,
      },
    });
  }

  async createBillingPortalSession(userId: string, returnUrl?: string) {
    const membership = await this.prisma.userMembership.findUnique({
      where: { userId },
    });

    if (!membership || !membership.stripeCustomerId) {
      throw new Error('No active subscription found for billing portal');
    }

    return this.stripeService.createBillingPortalSession({
      customer: membership.stripeCustomerId,
      return_url: returnUrl ?? this.defaultPortalReturnUrl,
    });
  }

  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const metadata = session.metadata ?? {};
    const userId = metadata.userId;
    const tierId = metadata.tierId;
    if (!userId || !tierId) {
      this.logger.warn(
        'Stripe checkout session missing userId/tierId metadata',
      );
      return;
    }

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!subscriptionId) {
      this.logger.warn(
        `Checkout session ${session.id} missing subscription reference`,
      );
      return;
    }

    const subscription =
      await this.stripeService.retrieveSubscription(subscriptionId);

    const status = this.mapStripeStatus(subscription.status);
    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;

    if (!customerId) {
      this.logger.warn(
        `Checkout session ${session.id} missing customer identifier`,
      );
      return;
    }

    await this.upsertMembershipFromStripe({
      userId,
      tierId,
      customerId,
      subscriptionId,
      status,
      currentPeriodEnd,
    });
  }

  async handleSubscriptionEvent(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.warn(
        `Subscription ${subscription.id} missing user metadata; skipping`,
      );
      return;
    }

    const priceId = subscription.items.data[0]?.price?.id;

    if (!priceId) {
      this.logger.warn(
        `Subscription ${subscription.id} missing price reference`,
      );
      return;
    }

    const tier = await this.prisma.membershipTier.findFirst({
      where: { stripePriceId: priceId },
    });

    if (!tier) {
      this.logger.warn(
        `No membership tier found for Stripe price ${priceId}; skipping`,
      );
      return;
    }

    const status = this.mapStripeStatus(subscription.status);
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;

    if (!customerId) {
      this.logger.warn(
        `Subscription ${subscription.id} missing customer identifier`,
      );
      return;
    }

    await this.upsertMembershipFromStripe({
      userId,
      tierId: tier.id,
      customerId,
      subscriptionId: subscription.id,
      status,
      currentPeriodEnd,
    });
  }

  private mapStripeStatus(
    status: Stripe.Subscription.Status,
  ): 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' {
    switch (status) {
      case 'active':
      case 'trialing':
      case 'incomplete':
        return 'ACTIVE';
      case 'past_due':
      case 'unpaid':
        return 'PAST_DUE';
      case 'canceled':
      case 'incomplete_expired':
      default:
        return 'CANCELLED';
    }
  }
}
