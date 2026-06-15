import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import {
  ConfirmEmailDto,
  RequestResetDto,
  RequestVerifyDto,
  ResetPasswordDto,
} from './dto/email-action.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly supabaseAuth: SupabaseAuthService,
  ) {}

  @Post('register')
  async register(@Body() payload: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(payload);
  }

  @Post('login')
  async login(@Body() payload: LoginDto): Promise<AuthResponseDto> {
    return this.authService.validateCredentials(payload);
  }

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
      throw new UnauthorizedException('Missing Supabase token in Authorization header');
    }
    return this.supabaseAuth.exchange(token);
  }

  @Post('request-verify')
  async requestVerify(@Body() payload: RequestVerifyDto) {
    return this.authService.requestEmailVerification(payload.email);
  }

  @Post('confirm-email')
  async confirmEmail(@Body() payload: ConfirmEmailDto) {
    return this.authService.confirmEmail(payload.token);
  }

  @Post('request-reset')
  async requestReset(@Body() payload: RequestResetDto) {
    return this.authService.requestPasswordReset(payload.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload.token, payload.password);
  }
}
