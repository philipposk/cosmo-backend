import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { ProfileSetting, User } from '../prisma/generated';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  toAuthResponse(user: User): AuthResponseDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      privacyLevel: user.privacyLevel,
      roles: user.roles,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      ageGateStatus: user.ageGateStatus,
      parentalControlLevel: user.parentalControlLevel,
      onboardingCompleted: user.onboardingCompleted,
    };
  }

  toProfileResponse(
    user: User,
    settings?: ProfileSetting | null,
  ): UserProfileDto {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      coverUrl: user.coverUrl,
      privacyLevel: user.privacyLevel,
      roles: user.roles,
      badges: user.badges,
      location: user.location,
      website: user.website,
      pronouns: user.pronouns,
      ageGateStatus: user.ageGateStatus,
      parentalControlLevel: user.parentalControlLevel,
      onboardingCompleted: user.onboardingCompleted,
      profileSettings: settings
        ? {
            showActivity: settings.showActivity,
            showLibraries: settings.showLibraries,
            showBadges: settings.showBadges,
            allowMessages: settings.allowMessages,
            allowMentions: settings.allowMentions,
          }
        : undefined,
    };
  }

  async getByUsername(
    username: string,
    viewer?: { id: string; roles?: string[] } | null,
  ): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // PRIVATE / FRIENDS profiles only reveal their full detail to the owner,
    // an admin, or (for FRIENDS) an accepted follower / active friend.
    if (!(await this.canViewFullProfile(viewer ?? null, user))) {
      return this.toMinimalProfileResponse(user);
    }

    const settings = await this.prisma.profileSetting.findUnique({
      where: { userId: user.id },
    });

    return this.toProfileResponse(user, settings);
  }

  /** Public-safe subset shown when a viewer may not see the full profile. */
  private toMinimalProfileResponse(user: User): UserProfileDto {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: null,
      avatarUrl: user.avatarUrl,
      coverUrl: null,
      privacyLevel: user.privacyLevel,
      roles: [],
      badges: [],
      location: null,
      website: null,
      pronouns: null,
      ageGateStatus: user.ageGateStatus,
      parentalControlLevel: user.parentalControlLevel,
      onboardingCompleted: user.onboardingCompleted,
      profileSettings: undefined,
    };
  }

  private async canViewFullProfile(
    viewer: { id: string; roles?: string[] } | null,
    user: User,
  ): Promise<boolean> {
    if (user.privacyLevel === 'PUBLIC') return true;
    if (!viewer) return false;
    if (viewer.id === user.id) return true;
    if (viewer.roles?.includes('ADMIN')) return true;

    if (user.privacyLevel === 'FRIENDS') {
      const [follow, friendship] = await Promise.all([
        this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewer.id,
              followingId: user.id,
            },
          },
          select: { status: true },
        }),
        this.prisma.friendship.findFirst({
          where: {
            status: 'ACTIVE',
            OR: [
              { initiatorId: viewer.id, recipientId: user.id },
              { initiatorId: user.id, recipientId: viewer.id },
            ],
          },
          select: { id: true },
        }),
      ]);
      return follow?.status === 'ACCEPTED' || friendship !== null;
    }

    // PRIVATE and viewer is neither owner nor admin.
    return false;
  }

  async updateProfile(
    userId: string,
    payload: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: payload.displayName ?? undefined,
        bio: payload.bio ?? undefined,
        avatarUrl: payload.avatarUrl ?? undefined,
        coverUrl: payload.coverUrl ?? undefined,
        location: payload.location ?? undefined,
        website: payload.website ?? undefined,
        pronouns: payload.pronouns ?? undefined,
      },
    });

    const settings = await this.prisma.profileSetting.findUnique({
      where: { userId },
    });

    return this.toProfileResponse(user, settings);
  }

  async updatePrivacy(
    userId: string,
    payload: UpdatePrivacyDto,
  ): Promise<UserProfileDto> {
    const [user, settings] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          privacyLevel: payload.privacyLevel ?? undefined,
        },
      }),
      this.prisma.profileSetting.upsert({
        where: { userId },
        update: {
          showActivity: payload.showActivity ?? undefined,
          showLibraries: payload.showLibraries ?? undefined,
          showBadges: payload.showBadges ?? undefined,
          allowMessages: payload.allowMessages ?? undefined,
          allowMentions: payload.allowMentions ?? undefined,
        },
        create: {
          userId,
          showActivity: payload.showActivity ?? true,
          showLibraries: payload.showLibraries ?? true,
          showBadges: payload.showBadges ?? true,
          allowMessages: payload.allowMessages ?? true,
          allowMentions: payload.allowMentions ?? true,
        },
      }),
    ]);

    return this.toProfileResponse(user, settings);
  }
}
