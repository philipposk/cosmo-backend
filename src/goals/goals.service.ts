import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentCategory } from '../prisma/generated';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string) {
    return this.prisma.goal.findMany({
      where: { ownerId },
      include: {
        _count: { select: { progressEvents: true } },
        progressEvents: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, ownerId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, ownerId },
      include: {
        progressEvents: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }

  async create(
    ownerId: string,
    payload: {
      title: string;
      description?: string;
      category?: ContentCategory;
      targetDate?: string;
    },
  ) {
    if (!payload.title?.trim()) {
      throw new BadRequestException('Title is required');
    }
    return this.prisma.goal.create({
      data: {
        ownerId,
        title: payload.title.trim(),
        description: payload.description ?? null,
        category: payload.category ?? ContentCategory.GOALS,
        targetDate: payload.targetDate ? new Date(payload.targetDate) : null,
      },
    });
  }

  async logProgress(
    goalId: string,
    ownerId: string,
    payload: { note: string; progress?: number },
  ) {
    if (!payload.note?.trim()) {
      throw new BadRequestException('Note is required');
    }
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, ownerId },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return this.prisma.goalProgress.create({
      data: {
        goalId,
        ownerId,
        note: payload.note.trim(),
        progress: payload.progress ?? 0,
      },
    });
  }

  async remove(id: string, ownerId: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id, ownerId } });
    if (!goal) throw new NotFoundException('Goal not found');
    await this.prisma.goal.delete({ where: { id } });
    return { success: true };
  }
}
