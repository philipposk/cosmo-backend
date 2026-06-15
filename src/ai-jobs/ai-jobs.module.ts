import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { MembershipModule } from '../membership/membership.module';
import { AIJobsController } from './ai-jobs.controller';
import { AIJobsService } from './ai-jobs.service';
import { AIJobsProcessor } from './processors/ai-jobs.processor';
import { AIProvidersModule } from '../ai-providers/ai-providers.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MembershipModule,
    AIProvidersModule,
    BullModule.registerQueue({
      name: 'ai-jobs',
    }),
  ],
  controllers: [AIJobsController],
  providers: [AIJobsService, AIJobsProcessor],
  exports: [AIJobsService],
})
export class AIJobsModule {}
