import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../membership/membership.service';
import { CreateAIJobDto } from './dto/create-ai-job.dto';
import { startOfUtcDay } from '../common/date.util';

export interface EnqueuedAIJobPayload {
  jobId: string;
  userId: string;
  request: {
    prompt: string;
    tone?: string;
    genre?: string;
    safetyLevel?: string;
    maxWords: number;
    modelIdentifier: string;
    tags: string[];
  };
}

@Injectable()
export class AIJobsService {
  private readonly logger = new Logger(AIJobsService.name);
  private readonly defaultMaxWords: number;
  private readonly defaultDailyQuota: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipService: MembershipService,
    private readonly configService: ConfigService,
    @InjectQueue('ai-jobs') private readonly queue: Queue<EnqueuedAIJobPayload>,
  ) {
    this.defaultMaxWords =
      this.configService.get<number>('AI_DEFAULT_MAX_WORDS') ?? 1000;
    this.defaultDailyQuota =
      this.configService.get<number>('AI_DEFAULT_DAILY_STORIES') ?? 3;
  }

  async submitJob(userId: string, dto: CreateAIJobDto) {
    const membership = await this.membershipService.getUserMembership(userId);

    const maxWords = membership?.tier.maxWordsPerStory ?? this.defaultMaxWords;
    const maxStoriesPerDay =
      membership?.tier.maxStoriesPerDay ?? this.defaultDailyQuota;
    const priority = membership?.tier.priorityLevel ?? 1;

    const model = await this.prisma.modelProvider.findUnique({
      where: { identifier: dto.modelIdentifier },
    });

    if (!model) {
      throw new Error(`Unknown model identifier: ${dto.modelIdentifier}`);
    }

    if (
      membership &&
      !membership.tier.availableModels.includes(dto.modelIdentifier)
    ) {
      throw new Error(
        'Selected model is not available for your membership tier',
      );
    }

    await this.assertAndIncrementDailyQuota(userId, maxStoriesPerDay);

    const jobRecord = await this.prisma.aIJob.create({
      data: {
        userId,
        prompt: dto.prompt,
        tone: dto.tone,
        genre: dto.genre,
        safetyLevel: dto.safetyLevel,
        modelId: model.id,
        priority,
      },
    });

    const payload: EnqueuedAIJobPayload = {
      jobId: jobRecord.id,
      userId,
      request: {
        prompt: dto.prompt,
        tone: dto.tone,
        genre: dto.genre,
        safetyLevel: dto.safetyLevel,
        maxWords,
        modelIdentifier: dto.modelIdentifier,
        tags: dto.tags ?? [],
      },
    };

    await this.queue.add('generate-story', payload, {
      priority,
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log(
      `Enqueued AI job ${jobRecord.id} for user ${userId} with priority ${priority}`,
    );

    return jobRecord;
  }

  getJobForUser(userId: string, jobId: string) {
    return this.prisma.aIJob.findFirst({
      where: {
        id: jobId,
        userId,
      },
      include: {
        resultStory: true,
        model: true,
      },
    });
  }

  listJobsForUser(userId: string) {
    return this.prisma.aIJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        resultStory: true,
        model: true,
      },
    });
  }

  async listModelsForUser(userId: string) {
    const membership = await this.membershipService.getUserMembership(userId);
    const models = await this.prisma.modelProvider.findMany({
      orderBy: { label: 'asc' },
    });

    if (!membership) {
      return models.filter((model) => model.maxWords >= this.defaultMaxWords);
    }

    const allowed = new Set(membership.tier.availableModels);

    if (allowed.size === 0) {
      return models;
    }

    return models.filter((model) => allowed.has(model.identifier));
  }

  private async assertAndIncrementDailyQuota(
    userId: string,
    maxStoriesPerDay: number,
  ) {
    const today = startOfUtcDay(new Date());

    const existingUsage = await this.prisma.dailyUserUsage.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (
      existingUsage &&
      maxStoriesPerDay > 0 &&
      existingUsage.storiesQueued >= maxStoriesPerDay
    ) {
      throw new Error(
        `Daily story limit reached (${maxStoriesPerDay} per day). Upgrade your membership for more generations.`,
      );
    }

    if (existingUsage) {
      await this.prisma.dailyUserUsage.update({
        where: { id: existingUsage.id },
        data: {
          storiesQueued: {
            increment: 1,
          },
        },
      });
    } else {
      await this.prisma.dailyUserUsage.create({
        data: {
          userId,
          date: today,
          storiesQueued: 1,
        },
      });
    }
  }
}
