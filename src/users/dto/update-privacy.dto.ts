import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PrivacyLevel } from '../../prisma/generated';

export class UpdatePrivacyDto {
  @IsOptional()
  @IsEnum(PrivacyLevel)
  privacyLevel?: PrivacyLevel;

  @IsOptional()
  @IsBoolean()
  showActivity?: boolean;

  @IsOptional()
  @IsBoolean()
  showLibraries?: boolean;

  @IsOptional()
  @IsBoolean()
  showBadges?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMentions?: boolean;
}
