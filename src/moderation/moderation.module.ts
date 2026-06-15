import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { RolesGuard } from '../common/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [ModerationController],
  providers: [ModerationService, RolesGuard],
  exports: [ModerationService],
})
export class ModerationModule {}
