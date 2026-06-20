import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContentCategory,
  NotificationKind,
  Prisma,
  ReactionKind,
  VisibilityLevel,
} from '../prisma/generated';
import {
  CreateCommentDto,
  CreatePostDto,
  ReactDto,
} from './dto/create-post.dto';
import { NotificationsService } from '../notifications/notifications.service';

const FEED_PAGE_SIZE = 20;

const POST_INCLUDE = {
  author: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  reactions: {
    select: { id: true, userId: true, kind: true },
  },
  media: {
    include: {
      media: {
        select: {
          id: true,
          kind: true,
          objectKey: true,
          bucket: true,
          contentType: true,
          status: true,
          width: true,
          height: true,
        },
      },
    },
  },
  _count: { select: { comments: true, reactions: true } },
} satisfies Prisma.PostInclude;

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(authorId: string, dto: CreatePostDto) {
    if (!dto.content?.trim()) {
      throw new BadRequestException('Post content is required');
    }

    return this.prisma.post.create({
      data: {
        authorId,
        title: dto.title ?? null,
        content: dto.content.trim(),
        category: dto.category ?? ContentCategory.UPDATE,
        visibility: dto.visibility ?? VisibilityLevel.FRIENDS,
        tags: dto.tags ?? [],
        media: dto.mediaIds?.length
          ? {
              create: dto.mediaIds.map((mediaId, index) => ({
                mediaId,
                position: index,
              })),
            }
          : undefined,
      },
      include: POST_INCLUDE,
    });
  }

  async list(viewerId: string, opts: { cursor?: string; authorId?: string }) {
    // Visibility filter: PUBLIC posts always; FRIENDS posts only if viewer
    // follows the author or it's their own; PRIVATE only own posts.
    const accepted = await this.prisma.follow.findMany({
      where: { followerId: viewerId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    const followingIds = accepted.map((f) => f.followingId);

    const where: Prisma.PostWhereInput = {
      AND: [
        opts.authorId ? { authorId: opts.authorId } : {},
        {
          OR: [
            { visibility: VisibilityLevel.PUBLIC },
            { authorId: viewerId },
            {
              visibility: VisibilityLevel.FRIENDS,
              authorId: { in: followingIds.length ? followingIds : ['__none__'] },
            },
          ],
        },
      ],
    };

    const posts = await this.prisma.post.findMany({
      where,
      include: POST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: FEED_PAGE_SIZE + 1,
      cursor: opts.cursor ? { id: opts.cursor } : undefined,
      skip: opts.cursor ? 1 : 0,
    });

    const hasMore = posts.length > FEED_PAGE_SIZE;
    const items = hasMore ? posts.slice(0, FEED_PAGE_SIZE) : posts;
    return {
      items: items.map((p) => this.shapePost(p, viewerId)),
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  async get(postId: string, viewerId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: POST_INCLUDE,
    });
    if (!post) throw new NotFoundException('Post not found');
    if (!(await this.canViewPost(post, viewerId))) {
      // Don't reveal that a private/friends-only post exists.
      throw new NotFoundException('Post not found');
    }
    return this.shapePost(post, viewerId);
  }

  /**
   * A viewer may see a post when it is PUBLIC, it's their own, or it's
   * FRIENDS-visibility and they have an ACCEPTED follow on the author.
   * PRIVATE posts are visible only to the author.
   */
  private async canViewPost(
    post: { authorId: string; visibility: VisibilityLevel },
    viewerId: string,
  ): Promise<boolean> {
    if (post.visibility === VisibilityLevel.PUBLIC) return true;
    if (post.authorId === viewerId) return true;
    if (post.visibility === VisibilityLevel.FRIENDS) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: post.authorId,
          },
        },
        select: { status: true },
      });
      return follow?.status === 'ACCEPTED';
    }
    return false;
  }

  async remove(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) {
      throw new BadRequestException('Only the author can delete this post');
    }
    await this.prisma.post.delete({ where: { id: postId } });
    return { success: true };
  }

  async react(postId: string, userId: string, dto: ReactDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    const kind = dto.kind as ReactionKind;

    const existing = await this.prisma.reaction.findUnique({
      where: { postId_userId_kind: { postId, userId, kind } },
    });

    if (existing) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      await this.prisma.post.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
      });
      return { reacted: false };
    }

    await this.prisma.reaction.create({
      data: { postId, userId, kind },
    });
    await this.prisma.post.update({
      where: { id: postId },
      data: { likesCount: { increment: 1 } },
    });

    if (post.authorId !== userId) {
      await this.notifications.create({
        userId: post.authorId,
        actorId: userId,
        kind: NotificationKind.POST_REACTION,
        targetType: 'POST',
        targetId: postId,
      });
    }

    return { reacted: true };
  }

  async listComments(postId: string, viewerId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, visibility: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (!(await this.canViewPost(post, viewerId))) {
      throw new NotFoundException('Post not found');
    }
    return this.prisma.comment.findMany({
      where: { postId, deletedAt: null },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async comment(postId: string, authorId: string, dto: CreateCommentDto) {
    if (!dto.body?.trim()) {
      throw new BadRequestException('Comment body is required');
    }
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        authorId,
        parentId: dto.parentId ?? null,
        body: dto.body.trim(),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    await this.prisma.post.update({
      where: { id: postId },
      data: { commentsCount: { increment: 1 } },
    });

    if (post.authorId !== authorId) {
      await this.notifications.create({
        userId: post.authorId,
        actorId: authorId,
        kind: NotificationKind.POST_COMMENT,
        targetType: 'POST',
        targetId: postId,
      });
    }

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });
      if (parent && parent.authorId !== authorId) {
        await this.notifications.create({
          userId: parent.authorId,
          actorId: authorId,
          kind: NotificationKind.COMMENT_REPLY,
          targetType: 'COMMENT',
          targetId: parent.id,
        });
      }
    }

    return comment;
  }

  async removeComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) {
      throw new BadRequestException('Only the author can delete this comment');
    }
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date(), body: '[deleted]' },
    });
    await this.prisma.post.update({
      where: { id: comment.postId },
      data: { commentsCount: { decrement: 1 } },
    });
    return { success: true };
  }

  async trendingTags(limit = 8) {
    const rows = await this.prisma.post.findMany({
      where: { visibility: VisibilityLevel.PUBLIC },
      select: { tags: true },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });
    const counts = new Map<string, number>();
    for (const r of rows) {
      for (const tag of r.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }

  private shapePost(
    post: Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>,
    viewerId: string,
  ) {
    return {
      id: post.id,
      createdAt: post.createdAt,
      author: post.author,
      title: post.title,
      content: post.content,
      category: post.category,
      visibility: post.visibility,
      tags: post.tags,
      likesCount: post.likesCount,
      commentsCount: post._count.comments,
      reactedKinds: post.reactions
        .filter((r) => r.userId === viewerId)
        .map((r) => r.kind),
      media: post.media
        .filter((pm) => pm.media?.status === 'READY')
        .sort((a, b) => a.position - b.position)
        .map((pm) => pm.media),
    };
  }
}
