import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReplyDto,
  CreateThreadDto,
  UpdateReplyDto,
  UpdateThreadDto,
} from './dto/forum.dto';

const SEED_FORUMS = [
  { slug: 'stories', name: 'Stories', description: 'Drafts, prompts, and finished novels.' },
  { slug: 'comics', name: 'Comics & illustration', description: 'Panels, covers, process posts.' },
  { slug: 'audio', name: 'Audio & podcasts', description: 'Narration, field recordings, mixing notes.' },
  { slug: 'craft', name: 'Craft & critique', description: 'Workshop space — share work for feedback.' },
  { slug: 'wellbeing', name: 'Wellbeing & care', description: 'Slow-living, routines, gentle accountability.' },
];

@Injectable()
export class ForumsService implements OnModuleInit {
  private readonly logger = new Logger(ForumsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Seed once at boot, idempotently — never on the request path (avoids the
  // previous race where two concurrent first-hits both inserted and the second
  // 500'd on the unique slug constraint).
  async onModuleInit() {
    try {
      await this.prisma.forum.createMany({
        data: SEED_FORUMS,
        skipDuplicates: true,
      });
    } catch (error) {
      this.logger.warn(
        `Forum seeding skipped: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async listForums() {
    return this.prisma.forum.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { threads: true } } },
    });
  }

  async listThreads(forumSlug: string) {
    const forum = await this.prisma.forum.findUnique({ where: { slug: forumSlug } });
    if (!forum) throw new NotFoundException('Forum not found');
    return this.prisma.forumThread.findMany({
      where: { forumId: forum.id },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        _count: { select: { replies: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  async getThread(threadId: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        forum: true,
        replies: {
          include: {
            author: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    return thread;
  }

  async createThread(authorId: string, forumSlug: string, dto: CreateThreadDto) {
    if (!dto.title?.trim() || !dto.body?.trim()) {
      throw new BadRequestException('Title and body are required');
    }
    const forum = await this.prisma.forum.findUnique({ where: { slug: forumSlug } });
    if (!forum) throw new NotFoundException('Forum not found');
    return this.prisma.forumThread.create({
      data: {
        forumId: forum.id,
        authorId,
        title: dto.title.trim(),
        body: dto.body.trim(),
      },
    });
  }

  async updateThread(threadId: string, userId: string, dto: UpdateThreadDto) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own thread');
    }
    return this.prisma.forumThread.update({
      where: { id: threadId },
      data: { title: dto.title.trim(), body: dto.body.trim() },
    });
  }

  async removeThread(threadId: string, userId: string, roles: string[]) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    const isStaff = roles.includes('ADMIN') || roles.includes('MOD');
    if (thread.authorId !== userId && !isStaff) {
      throw new ForbiddenException('You can only delete your own thread');
    }
    await this.prisma.forumThread.delete({ where: { id: threadId } });
    return { success: true };
  }

  async reply(authorId: string, threadId: string, dto: CreateReplyDto) {
    if (!dto.content?.trim()) {
      throw new BadRequestException('Reply cannot be empty');
    }
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) throw new NotFoundException('Thread not found');

    // Create the reply and bump the denormalised counter atomically so they
    // can never drift apart.
    const [reply] = await this.prisma.$transaction([
      this.prisma.forumReply.create({
        data: { threadId, authorId, content: dto.content.trim() },
      }),
      this.prisma.forumThread.update({
        where: { id: threadId },
        data: { replyCount: { increment: 1 }, updatedAt: new Date() },
      }),
    ]);
    return reply;
  }

  async updateReply(replyId: string, userId: string, dto: UpdateReplyDto) {
    const reply = await this.prisma.forumReply.findUnique({
      where: { id: replyId },
    });
    if (!reply) throw new NotFoundException('Reply not found');
    if (reply.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own reply');
    }
    return this.prisma.forumReply.update({
      where: { id: replyId },
      data: { content: dto.content.trim() },
    });
  }

  async removeReply(replyId: string, userId: string, roles: string[]) {
    const reply = await this.prisma.forumReply.findUnique({
      where: { id: replyId },
    });
    if (!reply) throw new NotFoundException('Reply not found');
    const isStaff = roles.includes('ADMIN') || roles.includes('MOD');
    if (reply.authorId !== userId && !isStaff) {
      throw new ForbiddenException('You can only delete your own reply');
    }
    await this.prisma.$transaction([
      this.prisma.forumReply.delete({ where: { id: replyId } }),
      this.prisma.forumThread.update({
        where: { id: reply.threadId },
        data: { replyCount: { decrement: 1 } },
      }),
    ]);
    return { success: true };
  }
}
