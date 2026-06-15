import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe.webhook.controller';
import { MembershipModule } from '../membership/membership.module';

@Module({
  imports: [ConfigModule, forwardRef(() => MembershipModule)],
  providers: [StripeService],
  controllers: [StripeWebhookController],
  exports: [StripeService],
})
export class StripeModule {}
