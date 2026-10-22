import {
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseAuthService } from './supabase-auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';

/**
 * Sign-in is passwordless and happens at Supabase (Google, or an emailed link/code on the shared
 * *.6x7.gr login). This API has no password signup, login, verify or reset routes: the only way in is
 * exchanging a Supabase access token for a Cosmo JWT.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly supabaseAuth: SupabaseAuthService) {}

  /**
   * Exchange a Supabase access token for a Cosmo JWT + user profile.
   * The frontend calls this after Supabase login to get the bearer token
   * used by all other Cosmo API endpoints.
   *
   * POST /auth/supabase-exchange
   * Authorization: Bearer <supabase_access_token>
   */
  @Post('supabase-exchange')
  async supabaseExchange(
    @Headers('authorization') authHeader: string,
  ): Promise<AuthResponseDto> {
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException(
        'Missing Supabase token in Authorization header',
      );
    }
    return this.supabaseAuth.exchange(token);
  }
}
