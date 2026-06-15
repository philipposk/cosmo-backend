import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class RequestCheckoutSessionDto {
  @IsString()
  @IsNotEmpty()
  tierSlug!: string;

  @IsOptional()
  @IsUrl()
  successUrl?: string;

  @IsOptional()
  @IsUrl()
  cancelUrl?: string;
}
