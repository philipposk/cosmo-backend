import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModerateStoryDto } from './dto/moderate-story.dto';

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  listFlaggedStories() {
    return this.prisma.story.findMany({
      where: { flagged: true },
      include: {
        user: true,
        model: true,
        tags: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async moderateStory(storyId: string, dto: ModerateStoryDto) {
    const story = await this.prisma.story.update({
      where: { id: storyId },
      data: {
        flagged: dto.decision === 'FLAGGED',
        status: dto.statusOverride ?? undefined,
        tags: dto.tags
          ? {
              deleteMany: {},
              create: dto.tags.map((tag) => ({
                key: tag.key,
                value: tag.value,
              })),
            }
          : undefined,
      },
      include: { tags: true },
    });

    return story;
  }
}
