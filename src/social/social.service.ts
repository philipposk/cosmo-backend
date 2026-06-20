import {
  ConflictException,
  ForbiddenException,
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

    // A block in either direction prevents following.
    const reverseBlock = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: followingId,
          followingId: followerId,
        },
      },
      select: { status: true },
    });
    if (reverseBlock?.status === FollowStatus.BLOCKED) {
      throw new ForbiddenException('You cannot follow this user.');
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
      if (existing.status === FollowStatus.BLOCKED) {
        throw new ForbiddenException(
          'Unblock this user before following them.',
        );
      }
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
    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (!existing) {
      throw new NotFoundException('Follow request not found');
    }
    if (existing.status === FollowStatus.BLOCKED) {
      throw new ConflictException('Cannot accept a blocked follow');
    }
    return this.prisma.follow.update({
      where: { followerId_followingId: { followerId, followingId } },
      data: { status: FollowStatus.ACCEPTED },
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

  /**
   * Block a user: record a BLOCKED follow row (blocker → blocked), drop the
   * blocked user's follow of the blocker, and end any friendship between them.
   */
  async block(blockerId: string, blockedId: string): Promise<{ blocked: true }> {
    if (blockerId === blockedId) {
      throw new ConflictException('Cannot block yourself');
    }
    await this.prisma.$transaction([
      this.prisma.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: blockerId,
            followingId: blockedId,
          },
        },
        update: { status: FollowStatus.BLOCKED },
        create: {
          followerId: blockerId,
          followingId: blockedId,
          status: FollowStatus.BLOCKED,
        },
      }),
      this.prisma.follow.deleteMany({
        where: { followerId: blockedId, followingId: blockerId },
      }),
      this.prisma.friendship.updateMany({
        where: {
          OR: [
            { initiatorId: blockerId, recipientId: blockedId },
            { initiatorId: blockedId, recipientId: blockerId },
          ],
        },
        data: { status: FriendshipStatus.BLOCKED },
      }),
    ]);
    return { blocked: true };
  }

  async unblock(
    blockerId: string,
    blockedId: string,
  ): Promise<{ blocked: false }> {
    await this.prisma.follow.deleteMany({
      where: {
        followerId: blockerId,
        followingId: blockedId,
        status: FollowStatus.BLOCKED,
      },
    });
    return { blocked: false };
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
    actorId: string,
  ): Promise<Friendship> {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }
    // Only the recipient of a pending request may accept or decline it.
    if (friendship.recipientId !== actorId) {
      throw new ForbiddenException(
        'Only the recipient can respond to this request',
      );
    }
    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new ConflictException('This request has already been answered');
    }
    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: accept ? FriendshipStatus.ACTIVE : FriendshipStatus.ENDED,
      },
    });
  }

  async removeFriendship(friendshipId: string, actorId: string): Promise<void> {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship) {
      return; // already gone — idempotent
    }
    if (
      friendship.initiatorId !== actorId &&
      friendship.recipientId !== actorId
    ) {
      throw new ForbiddenException('You are not part of this friendship');
    }
    await this.prisma.friendship.delete({ where: { id: friendshipId } });
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

  // Public profile fields only — never leak email or auth columns through the
  // social graph (these list endpoints are guest-readable).
  private static readonly PUBLIC_USER_SELECT = {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    privacyLevel: true,
  } as const;

  async listFollowers(userId: string) {
    return this.prisma.follow.findMany({
      where: { followingId: userId, status: FollowStatus.ACCEPTED },
      include: { follower: { select: SocialService.PUBLIC_USER_SELECT } },
    });
  }

  async listFollowing(userId: string) {
    return this.prisma.follow.findMany({
      where: { followerId: userId, status: FollowStatus.ACCEPTED },
      include: { following: { select: SocialService.PUBLIC_USER_SELECT } },
    });
  }
}
