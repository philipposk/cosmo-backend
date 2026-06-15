import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MailerService } from '../common/mailer';
import { SupabaseAuthService } from './supabase-auth.service';

@Module({
  imports: [ConfigModule, PrismaModule, UsersModule],
  controllers: [AuthController],
  providers: [AuthService, MailerService, SupabaseAuthService],
  exports: [AuthService, SupabaseAuthService],
})
export class AuthModule {}
