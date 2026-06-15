import { Prisma, PrivacyLevel, Role } from '../../prisma/generated';

export class UserProfileDto {
  id!: string;
  username!: string;
  displayName!: string;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  privacyLevel!: PrivacyLevel;
  roles!: Role[];
  badges?: Prisma.JsonValue | null;
  location?: string | null;
  website?: string | null;
  pronouns?: string | null;
  ageGateStatus!: string;
  parentalControlLevel?: number | null;
  onboardingCompleted!: boolean;
  profileSettings?: {
    showActivity: boolean;
    showLibraries: boolean;
    showBadges: boolean;
    allowMessages: boolean;
    allowMentions: boolean;
  } | null;
}
