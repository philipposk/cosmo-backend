import { IsString } from 'class-validator';

export class FollowRequestDto {
  @IsString()
  followerId!: string;

  @IsString()
  followingId!: string;
}
