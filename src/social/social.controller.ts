import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SocialService } from './social.service';
import { FollowRequestDto } from './dto/follow-request.dto';
import { FriendRequestDto } from './dto/friend-request.dto';
import { FriendResponseDto } from './dto/friend-response.dto';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post('follow')
  async follow(@Body() payload: FollowRequestDto) {
    return this.socialService.requestFollow(
      payload.followerId,
      payload.followingId,
    );
  }

  @Patch('follow/accept')
  async acceptFollow(@Body() payload: FollowRequestDto) {
    return this.socialService.acceptFollow(
      payload.followerId,
      payload.followingId,
    );
  }

  @Delete('follow')
  async unfollow(@Body() payload: FollowRequestDto) {
    await this.socialService.removeFollow(
      payload.followerId,
      payload.followingId,
    );
    return { success: true };
  }

  @Post('friend')
  async requestFriend(@Body() payload: FriendRequestDto) {
    return this.socialService.requestFriendship(
      payload.initiatorId,
      payload.recipientId,
    );
  }

  @Patch('friend/respond')
  async respondFriend(@Body() payload: FriendResponseDto) {
    return this.socialService.respondFriendship(
      payload.friendshipId,
      payload.accept,
    );
  }

  @Delete('friend/:friendshipId')
  async removeFriend(@Param('friendshipId') friendshipId: string) {
    await this.socialService.removeFriendship(friendshipId);
    return { success: true };
  }

  @Get('status')
  async status(
    @Query('viewerId') viewerId: string,
    @Query('targetId') targetId: string,
  ) {
    return this.socialService.getStatus(viewerId, targetId);
  }

  @Get('followers/:userId')
  async followers(@Param('userId') userId: string) {
    return this.socialService.listFollowers(userId);
  }

  @Get('following/:userId')
  async following(@Param('userId') userId: string) {
    return this.socialService.listFollowing(userId);
  }
}
