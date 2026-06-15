import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StoryVisibilityValue } from './story.constants';

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  listStoriesForUser(userId: string) {
    return this.prisma.story.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        model: true,
        tags: true,
      },
    });
  }

  async getStoryForUser(userId: string, storyId: string) {
    const story = await this.prisma.story.findFirst({
      where: {
        id: storyId,
        userId,
      },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        model: true,
        tags: true,
      },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    return story;
  }

  async updateStory(userId: string, storyId: string, dto: UpdateStoryDto) {
    const story = await this.prisma.story.findFirst({
      where: {
        id: storyId,
        userId,
      },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const { body, ...rest } = dto;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedStory = await tx.story.update({
        where: { id: storyId },
        data: {
          ...rest,
          ...(body ? { body } : {}),
        },
      });

      if (body) {
        await tx.storyVersion.create({
          data: {
            storyId,
            body,
            createdBy: userId,
          },
        });
      }

      return updatedStory;
    });

    return updated;
  }

  async publishStory(userId: string, storyId: string) {
    const story = await this.getStoryForUser(userId, storyId);
    if (story.status === 'PUBLISHED') {
      return story;
    }

    return this.prisma.story.update({
      where: { id: storyId },
      data: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        publishedAt: new Date(),
      },
    });
  }

  async updateVisibility(
    userId: string,
    storyId: string,
    visibility: StoryVisibilityValue,
  ) {
    await this.getStoryForUser(userId, storyId);
    return this.prisma.story.update({
      where: { id: storyId },
      data: { visibility },
    });
  }
}
