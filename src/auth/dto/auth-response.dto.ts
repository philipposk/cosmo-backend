import { PrivacyLevel, Role } from '../../prisma/generated';

export class AuthResponseDto {
  id!: string;
  email?: string | null;
  username!: string;
  displayName!: string;
  privacyLevel!: PrivacyLevel;
  roles!: Role[];
  avatarUrl?: string | null;
  bio?: string | null;
  ageGateStatus!: string;
  parentalControlLevel?: number | null;
  onboardingCompleted!: boolean;
  token?: string;
}
