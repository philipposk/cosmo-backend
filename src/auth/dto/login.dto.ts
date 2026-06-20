import { IsNotEmpty, IsString, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  // Require a username only when no email is provided (and vice versa), so a
  // request with neither identifier is rejected at validation instead of
  // failing deeper in the service.
  @ValidateIf((o: LoginDto) => !o.email)
  @IsString()
  @IsNotEmpty({ message: 'Provide a username or email.' })
  username?: string;

  @ValidateIf((o: LoginDto) => !o.username)
  @IsString()
  @IsNotEmpty({ message: 'Provide a username or email.' })
  email?: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
