import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { SocialService } from './social.service';
import { FollowRequestDto } from './dto/follow-request.dto';
import { FriendRequestDto } from './dto/friend-request.dto';
import { FriendResponseDto } from './dto/friend-response.dto';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  // ── Mutations: actor is ALWAYS the authenticated user, never the body. ──────

  @Post('follow')
  @UseGuards(AuthenticatedGuard)
  async follow(
    @Req() req: AuthenticatedRequest,
    @Body() payload: FollowRequestDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.socialService.requestFollow(id, payload.followingId);
  }

  @Patch('follow/accept')
  @UseGuards(AuthenticatedGuard)
  async acceptFollow(
    @Req() req: AuthenticatedRequest,
    @Body() payload: FollowRequestDto,
  ) {
    // The authenticated user is the followee accepting an incoming request.
    const { id } = assertAuthenticatedUser(req);
    return this.socialService.acceptFollow(payload.followerId, id);
  }

  @Delete('follow')
  @UseGuards(AuthenticatedGuard)
  async unfollow(
    @Req() req: AuthenticatedRequest,
    @Body() payload: FollowRequestDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    await this.socialService.removeFollow(id, payload.followingId);
    return { success: true };
  }

  @Post('friend')
  @UseGuards(AuthenticatedGuard)
  async requestFriend(
    @Req() req: AuthenticatedRequest,
    @Body() payload: FriendRequestDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.socialService.requestFriendship(id, payload.recipientId);
  }

  @Patch('friend/respond')
  @UseGuards(AuthenticatedGuard)
  async respondFriend(
    @Req() req: AuthenticatedRequest,
    @Body() payload: FriendResponseDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.socialService.respondFriendship(
      payload.friendshipId,
      payload.accept,
      id,
    );
  }

  @Delete('friend/:friendshipId')
  @UseGuards(AuthenticatedGuard)
  async removeFriend(
    @Req() req: AuthenticatedRequest,
    @Param('friendshipId') friendshipId: string,
  ) {
    const { id } = assertAuthenticatedUser(req);
    await this.socialService.removeFriendship(friendshipId, id);
    return { success: true };
  }

  @Post('block')
  @UseGuards(AuthenticatedGuard)
  async block(
    @Req() req: AuthenticatedRequest,
    @Body() payload: FollowRequestDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.socialService.block(id, payload.followingId);
  }

  @Delete('block/:targetId')
  @UseGuards(AuthenticatedGuard)
  async unblock(
    @Req() req: AuthenticatedRequest,
    @Param('targetId') targetId: string,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.socialService.unblock(id, targetId);
  }

  // ── Relationship status needs the viewer's identity → authenticated. ────────

  @Get('status')
  @UseGuards(AuthenticatedGuard)
  async status(
    @Req() req: AuthenticatedRequest,
    @Query('targetId') targetId: string,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.socialService.getStatus(id, targetId);
  }

  // ── Public follower/following lists (guest-readable) — public subset only. ──

  @Get('followers/:userId')
  async followers(@Param('userId') userId: string) {
    return this.socialService.listFollowers(userId);
  }

  @Get('following/:userId')
  async following(@Param('userId') userId: string) {
    return this.socialService.listFollowing(userId);
  }
}
