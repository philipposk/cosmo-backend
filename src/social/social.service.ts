import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FollowStatus,
  FriendshipStatus,
  PrivacyLevel,
  Follow,
  Friendship,
} from '../prisma/generated';

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

  async requestFollow(
    followerId: string,
    followingId: string,
  ): Promise<Follow> {
    if (followerId === followingId) {
      throw new ConflictException('Cannot follow yourself');
    }

    const existing = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
    if (existing) {
      return existing;
    }

    const target = await this.prisma.user.findUnique({
      where: { id: followingId },
      select: { privacyLevel: true },
    });

    if (!target) {
      throw new NotFoundException('Target user not found');
    }

    const status =
      target.privacyLevel === PrivacyLevel.PUBLIC
        ? FollowStatus.ACCEPTED
        : FollowStatus.PENDING;

    return this.prisma.follow.create({
      data: {
        followerId,
        followingId,
        status,
      },
    });
  }

  async acceptFollow(followerId: string, followingId: string): Promise<Follow> {
    return this.prisma.follow.update({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
      data: {
        status: FollowStatus.ACCEPTED,
      },
    });
  }

  async removeFollow(followerId: string, followingId: string): Promise<void> {
    await this.prisma.follow.deleteMany({
      where: {
        followerId,
        followingId,
      },
    });
  }

  async requestFriendship(
    initiatorId: string,
    recipientId: string,
  ): Promise<Friendship> {
    if (initiatorId === recipientId) {
      throw new ConflictException('Cannot friend yourself');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId, recipientId },
          { initiatorId: recipientId, recipientId: initiatorId },
        ],
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.friendship.create({
      data: {
        initiatorId,
        recipientId,
      },
    });
  }

  async respondFriendship(
    friendshipId: string,
    accept: boolean,
  ): Promise<Friendship> {
    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: accept ? FriendshipStatus.ACTIVE : FriendshipStatus.ENDED,
      },
    });
  }

  async removeFriendship(friendshipId: string): Promise<void> {
    await this.prisma.friendship.deleteMany({ where: { id: friendshipId } });
  }

  async getStatus(viewerId: string, targetId: string) {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: targetId,
        },
      },
    });

    const reverseFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: targetId,
          followingId: viewerId,
        },
      },
    });

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: viewerId, recipientId: targetId },
          { initiatorId: targetId, recipientId: viewerId },
        ],
      },
    });

    return {
      followStatus: follow?.status ?? null,
      reciprocalFollowStatus: reverseFollow?.status ?? null,
      friendshipStatus: friendship?.status ?? null,
      friendshipId: friendship?.id ?? null,
    };
  }

  async listFollowers(userId: string) {
    return this.prisma.follow.findMany({
      where: { followingId: userId, status: FollowStatus.ACCEPTED },
      include: { follower: true },
    });
  }

  async listFollowing(userId: string) {
    return this.prisma.follow.findMany({
      where: { followerId: userId, status: FollowStatus.ACCEPTED },
      include: { following: true },
    });
  }
}
