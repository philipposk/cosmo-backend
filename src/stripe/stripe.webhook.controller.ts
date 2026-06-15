import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { MembershipService } from '../membership/membership.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly membershipService: MembershipService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    // Nest by default parses the body; prefer raw body middleware in main.ts for real signature verification.
    if (!signature) {
      this.logger.warn('Missing Stripe signature header');
      return { received: false };
    }

    try {
      const rawRequest = req as RawBodyRequest;
      const buffer =
        rawRequest.rawBody ??
        Buffer.from(
          typeof body === 'string' ? body : JSON.stringify(body ?? {}),
        );
      const event = this.stripeService.constructEventFromPayload(
        buffer,
        signature,
      );

      await this.dispatchEvent(event);
    } catch (error) {
      this.logger.error(
        `Failed to process Stripe webhook: ${error instanceof Error ? error.message : error}`,
      );
      return { received: false };
    }

    return { received: true };
  }

  private async dispatchEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.membershipService.handleCheckoutSessionCompleted(
          event.data.object,
        );
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.membershipService.handleSubscriptionEvent(event.data.object);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }
  }
}
