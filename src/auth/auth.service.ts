import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { MailerService } from '../common/mailer';
import * as jwt from 'jsonwebtoken';
import { User } from '../prisma/generated';

const BCRYPT_ROUNDS = 12;
const DEFAULT_JWT_SECRET = 'development-jwt-secret';
const DEFAULT_JWT_EXPIRES_IN = '7d';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mailer: MailerService,
  ) {}

  private signToken(user: User): string {
    const secret: jwt.Secret =
      process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
    const expiresInValue =
      process.env.JWT_EXPIRES_IN ?? DEFAULT_JWT_EXPIRES_IN;
    const options: jwt.SignOptions = {
      expiresIn: expiresInValue as jwt.SignOptions['expiresIn'],
    };

    return jwt.sign(
      {
        sub: user.id,
        username: user.username,
        roles: user.roles,
      },
      secret,
      options
    );
  }

  private toAuthResponseWithToken(user: User): AuthResponseDto {
    const response = this.usersService.toAuthResponse(user);
    response.token = this.signToken(user);
    return response;
  }

  async register(payload: RegisterDto): Promise<AuthResponseDto> {
    const { email, username } = payload;

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          ...(email ? [{ email: email.toLowerCase() }] : []),
        ],
      },
    });

    if (existing) {
      throw new ConflictException('Username or email already exists');
    }

    const hashedPassword = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: email ? email.toLowerCase() : null,
        username: username.toLowerCase(),
        displayName: payload.displayName ?? username,
        hashedPassword,
        bio: payload.bio ?? null,
      },
    });

    await this.prisma.profileSetting.create({
      data: {
        userId: user.id,
      },
    });

    return this.toAuthResponseWithToken(user);
  }

  async validateCredentials(payload: LoginDto): Promise<AuthResponseDto> {
    const identifier =
      payload.username?.toLowerCase() ?? payload.email?.toLowerCase();

    if (!identifier) {
      throw new UnauthorizedException('Username or email is required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: payload.username?.toLowerCase() },
          { email: payload.email?.toLowerCase() },
        ],
      },
    });

    if (!user || !user.hashedPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(payload.password, user.hashedPassword);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.toAuthResponseWithToken(user);
  }

  async requestEmailVerification(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      // Don't leak account existence — pretend success.
      return { ok: true };
    }
    if (user.emailVerified) {
      return { ok: true };
    }
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await this.prisma.verificationToken.create({
      data: {
        identifier: `verify:${user.email}`,
        token,
        expires,
        userId: user.id,
      },
    });
    const frontend =
      process.env.FRONTEND_ORIGIN?.split(',')[0] ?? 'http://localhost:5176';
    await this.mailer.send({
      to: user.email!,
      subject: 'Confirm your Cosmo email',
      text: `Hi ${user.displayName},\n\nConfirm your email: ${frontend}/auth/confirm?token=${token}\n\nLink expires in 24h.`,
    });
    return { ok: true };
  }

  async confirmEmail(token: string): Promise<{ ok: true }> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { token },
    });
    if (!record || !record.userId || record.expires < new Date()) {
      throw new BadRequestException('Verification token is invalid or expired');
    }
    if (!record.identifier.startsWith('verify:')) {
      throw new BadRequestException('Token is not a verification token');
    }
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    });
    await this.prisma.verificationToken.delete({ where: { token } });
    return { ok: true };
  }

  async requestPasswordReset(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) return { ok: true };
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60);
    await this.prisma.verificationToken.create({
      data: {
        identifier: `reset:${user.email}`,
        token,
        expires,
        userId: user.id,
      },
    });
    const frontend =
      process.env.FRONTEND_ORIGIN?.split(',')[0] ?? 'http://localhost:5176';
    await this.mailer.send({
      to: user.email!,
      subject: 'Reset your Cosmo password',
      text: `Hi ${user.displayName},\n\nReset your password: ${frontend}/auth/reset?token=${token}\n\nLink expires in 60 minutes. If you didn't request this, ignore this email.`,
    });
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        'New password must be at least 8 characters',
      );
    }
    const record = await this.prisma.verificationToken.findUnique({
      where: { token },
    });
    if (!record || !record.userId || record.expires < new Date()) {
      throw new BadRequestException('Reset token is invalid or expired');
    }
    if (!record.identifier.startsWith('reset:')) {
      throw new BadRequestException('Token is not a password-reset token');
    }
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { hashedPassword },
    });
    await this.prisma.verificationToken.delete({ where: { token } });
    return { ok: true };
  }
}
