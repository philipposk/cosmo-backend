import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  readonly client: Stripe | null;
  private readonly webhookSecret?: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!apiKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not configured; Stripe features are disabled.',
      );
      this.client = null;
      return;
    }

    this.client = new Stripe(apiKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  ensureClient(): Stripe {
    if (!this.client) {
      throw new Error('Stripe client is not configured');
    }

    return this.client;
  }

  async createCheckoutSession(params: Stripe.Checkout.SessionCreateParams) {
    const stripe = this.ensureClient();
    return stripe.checkout.sessions.create(params);
  }

  async createBillingPortalSession(
    params: Stripe.BillingPortal.SessionCreateParams,
  ) {
    const stripe = this.ensureClient();
    return stripe.billingPortal.sessions.create(params);
  }

  async retrieveSubscription(subscriptionId: string) {
    const stripe = this.ensureClient();
    return stripe.subscriptions.retrieve(subscriptionId);
  }

  constructEventFromPayload(payload: Buffer, signature: string) {
    const stripe = this.ensureClient();
    if (!this.webhookSecret) {
      throw new Error('Stripe webhook secret is not configured');
    }

    return stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );
  }
}
