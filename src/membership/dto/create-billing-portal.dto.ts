import { IsOptional, IsUrl } from 'class-validator';

export class CreateBillingPortalDto {
  @IsOptional()
  @IsUrl()
  returnUrl?: string;
}
