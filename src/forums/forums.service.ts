import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ForumsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSeed() {
    const count = await this.prisma.forum.count();
    if (count > 0) return;
    await this.prisma.forum.createMany({
      data: [
        { slug: 'stories', name: 'Stories', description: 'Drafts, prompts, and finished novels.' },
        { slug: 'comics', name: 'Comics & illustration', description: 'Panels, covers, process posts.' },
        { slug: 'audio', name: 'Audio & podcasts', description: 'Narration, field recordings, mixing notes.' },
        { slug: 'craft', name: 'Craft & critique', description: 'Workshop space — share work for feedback.' },
        { slug: 'wellbeing', name: 'Wellbeing & care', description: 'Slow-living, routines, gentle accountability.' },
      ],
    });
  }

  async listForums() {
    await this.ensureSeed();
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

  async createThread(
    authorId: string,
    forumSlug: string,
    payload: { title: string; body: string },
  ) {
    if (!payload.title?.trim() || !payload.body?.trim()) {
      throw new BadRequestException('Title and body are required');
    }
    const forum = await this.prisma.forum.findUnique({ where: { slug: forumSlug } });
    if (!forum) throw new NotFoundException('Forum not found');
    return this.prisma.forumThread.create({
      data: {
        forumId: forum.id,
        authorId,
        title: payload.title.trim(),
        body: payload.body.trim(),
      },
    });
  }

  async reply(authorId: string, threadId: string, content: string) {
    if (!content?.trim()) throw new BadRequestException('Reply cannot be empty');
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    const reply = await this.prisma.forumReply.create({
      data: { threadId, authorId, content: content.trim() },
    });
    await this.prisma.forumThread.update({
      where: { id: threadId },
      data: { replyCount: { increment: 1 }, updatedAt: new Date() },
    });
    return reply;
  }
}
