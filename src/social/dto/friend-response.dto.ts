import { IsBoolean, IsString } from 'class-validator';

export class FriendResponseDto {
  @IsString()
  friendshipId!: string;

  @IsBoolean()
  accept!: boolean;
}
