import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { RequestCheckoutSessionDto } from './dto/request-checkout-session.dto';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import { CreateBillingPortalDto } from './dto/create-billing-portal.dto';
import type { AuthenticatedRequest } from '../common/auth-request.util';

@Controller()
@UseGuards(AuthenticatedGuard)
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('membership/tiers')
  listTiers() {
    return this.membershipService.listTiers();
  }

  @Get('membership/me')
  getCurrentMembership(@Req() req: AuthenticatedRequest) {
    const userId = assertAuthenticatedUser(req).id;
    return this.membershipService.getUserMembership(userId);
  }

  @Post('membership/checkout')
  createCheckoutSession(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RequestCheckoutSessionDto,
  ) {
    const userId = assertAuthenticatedUser(req).id;
    return this.membershipService.createCheckoutSession(userId, dto);
  }

  @Post('membership/billing-portal')
  createBillingPortalSession(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateBillingPortalDto,
  ) {
    const userId = assertAuthenticatedUser(req).id;
    return this.membershipService.createBillingPortalSession(
      userId,
      dto.returnUrl,
    );
  }
}
