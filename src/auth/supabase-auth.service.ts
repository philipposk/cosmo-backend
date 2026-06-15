import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import * as jwt from 'jsonwebtoken';
import { User } from '../prisma/generated';

const DEFAULT_JWT_SECRET = 'development-jwt-secret';

@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private readonly supabase: SupabaseClient | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {
    const url = config.get<string>('SUPABASE_URL');
    const serviceKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && serviceKey) {
      this.supabase = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      this.logger.log('Supabase admin client initialised');
    } else {
      this.supabase = null;
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — Supabase exchange disabled',
      );
    }
  }

  isEnabled(): boolean {
    return this.supabase !== null;
  }

  /**
   * Verify a Supabase access token, find or create the matching Cosmo user,
   * and return a Cosmo JWT + user profile.
   *
   * Called by POST /auth/supabase-exchange.
   */
  async exchange(supabaseToken: string): Promise<AuthResponseDto> {
    if (!this.supabase) {
      throw new UnauthorizedException(
        'Supabase auth is not configured on this server.',
      );
    }

    const { data, error } = await this.supabase.auth.getUser(supabaseToken);
    if (error || !data.user) {
      throw new UnauthorizedException(
        `Invalid Supabase token: ${error?.message ?? 'no user'}`,
      );
    }

    const supabaseUser = data.user;
    const email = supabaseUser.email ?? null;
    const supabaseId = supabaseUser.id;

    // Find existing user by supabaseId or email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { supabaseId },
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (!user) {
      // Just-in-time provisioning
      const username = this.deriveUsername(supabaseUser);
      const displayName =
        (supabaseUser.user_metadata?.display_name as string | undefined) ??
        (supabaseUser.user_metadata?.full_name as string | undefined) ??
        (supabaseUser.user_metadata?.name as string | undefined) ??
        username;

      user = await this.prisma.user.create({
        data: {
          email,
          username,
          displayName,
          supabaseId,
          emailVerified: email ? new Date() : null,
          profileSettings: { create: {} },
        },
      });

      this.logger.log(`JIT provisioned user ${user.id} for Supabase ${supabaseId}`);
    } else if (!user.supabaseId) {
      // Link existing user to Supabase
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { supabaseId },
      });
    }

    const response = this.users.toAuthResponse(user);
    response.token = this.signToken(user);
    return response;
  }

  private signToken(user: User): string {
    const secret = this.config.get<string>('JWT_SECRET') ?? DEFAULT_JWT_SECRET;
    return jwt.sign(
      { sub: user.id, username: user.username, roles: user.roles },
      secret,
      { expiresIn: '7d' },
    );
  }

  private deriveUsername(supabaseUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }): string {
    // Prefer explicit username set during sign-up
    const meta = supabaseUser.user_metadata ?? {};
    if (typeof meta['username'] === 'string' && meta['username'].trim()) {
      // Still append short suffix to handle duplicates
      return `${(meta['username'] as string).toLowerCase().replace(/[^a-z0-9_]/gi, '_')}_${Math.random().toString(36).slice(2, 6)}`;
    }
    const base = supabaseUser.email
      ? supabaseUser.email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase()
      : `user_${supabaseUser.id.slice(0, 8)}`;
    return `${base}_${Math.random().toString(36).slice(2, 6)}`;
  }
}
