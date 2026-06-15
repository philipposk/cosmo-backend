import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentCategory, VisibilityLevel } from '../prisma/generated';

@Injectable()
export class LibrariesService {
  constructor(private readonly prisma: PrismaService) {}

  async listOwn(ownerId: string) {
    return this.prisma.libraryItem.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listPublic(ownerId: string) {
    return this.prisma.libraryItem.findMany({
      where: { ownerId, visibility: VisibilityLevel.PUBLIC },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(
    ownerId: string,
    payload: {
      title: string;
      description?: string;
      category?: ContentCategory;
      visibility?: VisibilityLevel;
      tags?: string[];
    },
  ) {
    if (!payload.title?.trim()) {
      throw new BadRequestException('Title is required');
    }
    return this.prisma.libraryItem.create({
      data: {
        ownerId,
        title: payload.title.trim(),
        description: payload.description ?? null,
        category: payload.category ?? ContentCategory.UPDATE,
        visibility: payload.visibility ?? VisibilityLevel.PUBLIC,
        tags: payload.tags ?? [],
      },
    });
  }

  async remove(id: string, ownerId: string) {
    const item = await this.prisma.libraryItem.findFirst({
      where: { id, ownerId },
    });
    if (!item) throw new NotFoundException('Library item not found');
    await this.prisma.libraryItem.delete({ where: { id } });
    return { success: true };
  }
}
