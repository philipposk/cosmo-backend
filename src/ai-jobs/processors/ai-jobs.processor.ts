import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnqueuedAIJobPayload } from '../ai-jobs.service';
import { ProviderRegistry } from '../../ai-providers/provider-registry.service';
import { startOfUtcDay } from '../../common/date.util';

@Processor('ai-jobs')
@Injectable()
export class AIJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(AIJobsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistry,
  ) {
    super();
  }

  async process(job: Job<EnqueuedAIJobPayload>): Promise<void> {
    this.logger.log(`Processing AI job ${job.id} (${job.name})`);

    try {
      const jobRecord = await this.prisma.aIJob.update({
        where: { id: job.data.jobId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
        },
        include: {
          model: true,
        },
      });

      if (!jobRecord.model) {
        throw new Error('AI model metadata missing on job');
      }

      const provider = this.providerRegistry.resolve(
        jobRecord.model.identifier,
      );

      const result = await provider.generateStory(job.data.request);

      const story = await this.prisma.$transaction(async (tx) => {
        const createdStory =
          jobRecord.resultStoryId &&
          (await tx.story.findUnique({
            where: { id: jobRecord.resultStoryId },
            include: { tags: true },
          }));

        const storyData = {
          userId: jobRecord.userId,
          title: result.title,
          synopsis: result.synopsis,
          body: result.content,
          modelId: jobRecord.modelId,
          safetyLevel: job.data.request.safetyLevel,
          status: 'DRAFT' as const,
          visibility: 'PRIVATE' as const,
        };

        let finalStoryId: string;

        if (createdStory) {
          finalStoryId = createdStory.id;
          await tx.story.update({
            where: { id: createdStory.id },
            data: {
              ...storyData,
              tags: {
                deleteMany: {},
                create: job.data.request.tags.map((tag) => ({
                  key: 'tag',
                  value: tag,
                })),
              },
            },
          });
        } else {
          const newStory = await tx.story.create({
            data: {
              ...storyData,
              tags: {
                create: job.data.request.tags.map((tag) => ({
                  key: 'tag',
                  value: tag,
                })),
              },
            },
          });
          finalStoryId = newStory.id;
        }

        await tx.storyVersion.create({
          data: {
            storyId: finalStoryId,
            body: result.content,
            note: 'Initial AI draft',
            createdBy: jobRecord.userId,
          },
        });

        await tx.aIJob.update({
          where: { id: jobRecord.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            resultStoryId: finalStoryId,
            tokensOutput: result.tokensUsed ?? null,
          },
        });

        await tx.notification.create({
          data: {
            userId: jobRecord.userId,
            kind: 'AI_JOB_COMPLETE',
            targetType: 'STORY',
            targetId: finalStoryId,
            message: result.title ?? 'Your story draft is ready.',
          },
        });

        const today = startOfUtcDay(new Date());
        await tx.dailyUserUsage.upsert({
          where: {
            userId_date: {
              userId: jobRecord.userId,
              date: today,
            },
          },
          create: {
            userId: jobRecord.userId,
            date: today,
            storiesQueued: 1,
            storiesCompleted: 1,
            tokensConsumed: result.tokensUsed ?? 0,
          },
          update: {
            storiesCompleted: { increment: 1 },
            tokensConsumed: {
              increment: result.tokensUsed ?? 0,
            },
          },
        });

        return finalStoryId;
      });

      this.logger.log(
        `AI job ${jobRecord.id} completed and stored story ${story}`,
      );
    } catch (error) {
      this.logger.error(
        `AI job ${job.id} failed: ${error instanceof Error ? error.message : error}`,
      );
      await this.prisma.aIJob.update({
        where: { id: job.data.jobId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }
}
