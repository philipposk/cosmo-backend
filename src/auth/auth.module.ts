import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { SupabaseAuthService } from './supabase-auth.service';

@Module({
  imports: [ConfigModule, PrismaModule, UsersModule],
  controllers: [AuthController],
  providers: [SupabaseAuthService],
  exports: [SupabaseAuthService],
})
export class AuthModule {}
