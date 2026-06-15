import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RequestVerifyDto {
  @IsEmail()
  email!: string;
}

export class ConfirmEmailDto {
  @IsString()
  @MinLength(16)
  token!: string;
}

export class RequestResetDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(16)
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  newPassword?: string;
}
