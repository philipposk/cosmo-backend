import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VisibilityLevel } from '../prisma/generated';

type Hit = {
  type: 'POST' | 'USER' | 'STORY' | 'LIBRARY' | 'FORUM_THREAD';
  id: string;
  title: string;
  snippet?: string | null;
  href: string;
};

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async query(q: string, viewerId?: string): Promise<Hit[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const contains = term;

    const [users, posts, stories, libraryItems, threads] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains, mode: 'insensitive' } },
            { displayName: { contains, mode: 'insensitive' } },
            { bio: { contains, mode: 'insensitive' } },
          ],
        },
        select: { id: true, username: true, displayName: true, bio: true },
        take: 8,
      }),
      this.prisma.post.findMany({
        where: {
          OR: [
            { title: { contains, mode: 'insensitive' } },
            { content: { contains, mode: 'insensitive' } },
            { tags: { has: term.toLowerCase() } },
          ],
          visibility: VisibilityLevel.PUBLIC,
        },
        select: { id: true, title: true, content: true },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.story.findMany({
        where: {
          OR: [
            { title: { contains, mode: 'insensitive' } },
            { synopsis: { contains, mode: 'insensitive' } },
          ],
          visibility: 'PUBLIC',
          status: 'PUBLISHED',
        },
        select: { id: true, title: true, synopsis: true },
        take: 8,
      }),
      this.prisma.libraryItem.findMany({
        where: {
          OR: [
            { title: { contains, mode: 'insensitive' } },
            { description: { contains, mode: 'insensitive' } },
            { tags: { has: term.toLowerCase() } },
          ],
          visibility: VisibilityLevel.PUBLIC,
        },
        select: { id: true, title: true, description: true },
        take: 8,
      }),
      this.prisma.forumThread.findMany({
        where: {
          OR: [
            { title: { contains, mode: 'insensitive' } },
            { body: { contains, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, body: true, forum: { select: { slug: true } } },
        take: 8,
      }),
    ]);

    const hits: Hit[] = [
      ...users.map((u) => ({
        type: 'USER' as const,
        id: u.id,
        title: u.displayName,
        snippet: u.bio ?? `@${u.username}`,
        href: `/profile/${u.username}`,
      })),
      ...posts.map((p) => ({
        type: 'POST' as const,
        id: p.id,
        title: p.title ?? 'Post',
        snippet: p.content.slice(0, 140),
        href: `/posts/${p.id}`,
      })),
      ...stories.map((s) => ({
        type: 'STORY' as const,
        id: s.id,
        title: s.title ?? 'Untitled story',
        snippet: s.synopsis,
        href: `/stories/${s.id}`,
      })),
      ...libraryItems.map((l) => ({
        type: 'LIBRARY' as const,
        id: l.id,
        title: l.title,
        snippet: l.description,
        href: `/libraries`,
      })),
      ...threads.map((t) => ({
        type: 'FORUM_THREAD' as const,
        id: t.id,
        title: t.title,
        snippet: t.body.slice(0, 140),
        href: `/forums/${t.forum.slug}/${t.id}`,
      })),
    ];

    return hits;
  }
}
