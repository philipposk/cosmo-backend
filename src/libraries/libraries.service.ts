import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentCategory, VisibilityLevel } from '../prisma/generated';
import {
  CreateLibraryItemDto,
  UpdateLibraryItemDto,
} from './dto/library-item.dto';

@Injectable()
export class LibrariesService {
  constructor(private readonly prisma: PrismaService) {}

  async listOwn(ownerId: string, category?: ContentCategory) {
    return this.prisma.libraryItem.findMany({
      where: { ownerId, ...(category ? { category } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listPublic(ownerId: string, category?: ContentCategory) {
    return this.prisma.libraryItem.findMany({
      where: {
        ownerId,
        visibility: VisibilityLevel.PUBLIC,
        ...(category ? { category } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(ownerId: string, dto: CreateLibraryItemDto) {
    if (!dto.title?.trim()) {
      throw new BadRequestException('Title is required');
    }
    return this.prisma.libraryItem.create({
      data: {
        ownerId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category ?? ContentCategory.UPDATE,
        visibility: dto.visibility ?? VisibilityLevel.PUBLIC,
        tags: this.normalizeTags(dto.tags),
      },
    });
  }

  async update(id: string, ownerId: string, dto: UpdateLibraryItemDto) {
    const existing = await this.prisma.libraryItem.findFirst({
      where: { id, ownerId },
    });
    if (!existing) throw new NotFoundException('Library item not found');

    return this.prisma.libraryItem.update({
      where: { id },
      data: {
        title: dto.title?.trim() ?? undefined,
        description:
          dto.description === undefined
            ? undefined
            : dto.description.trim() || null,
        category: dto.category ?? undefined,
        visibility: dto.visibility ?? undefined,
        tags: dto.tags ? this.normalizeTags(dto.tags) : undefined,
      },
    });
  }

  async remove(id: string, ownerId: string) {
    // Single atomic, ownership-scoped delete.
    const { count } = await this.prisma.libraryItem.deleteMany({
      where: { id, ownerId },
    });
    if (count === 0) throw new NotFoundException('Library item not found');
    return { success: true };
  }

  /** Trim, drop empties, de-duplicate (case-insensitive), cap at 20. */
  private normalizeTags(tags?: string[]): string[] {
    if (!tags?.length) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of tags) {
      const tag = raw.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
      if (out.length >= 20) break;
    }
    return out;
  }
}
