import { IsString } from 'class-validator';

export class FriendRequestDto {
  @IsString()
  initiatorId!: string;

  @IsString()
  recipientId!: string;
}
