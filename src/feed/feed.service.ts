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

    const post = await this.prisma.post.create({
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

    await this.notifyMentions({
      text: dto.content,
      actorId: authorId,
      targetType: 'POST',
      targetId: post.id,
    });

    return post;
  }

  async list(
    viewerId: string,
    opts: { cursor?: string; authorId?: string; sort?: 'new' | 'hot' },
  ) {
    if (opts.sort === 'hot') {
      return this.listHot(viewerId, opts.cursor, opts.authorId);
    }
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

  /**
   * "Hot" feed — Hacker-News-style power-law ranking computed on read:
   *   score = (1 + likes + 2*comments) / (ageHours + 2) ^ GRAVITY
   *
   * Gravity is tuned down to 1.5 (vs HN's 1.8) because this is a calm,
   * low-volume community: gentler decay keeps good posts visible for a day or
   * two while fresh posts still climb. The `1 +` baseline gives brand-new,
   * zero-engagement posts a fighting chance (cold-start fix).
   *
   * The decay depends on "now", so a stored/indexed score is impossible — we
   * compute it in SQL with a snapshotted timestamp that is carried inside the
   * cursor, so the ordering stays stable across pages of one scroll session.
   */
  private async listHot(viewerId: string, cursor?: string, authorId?: string) {
    const GRAVITY = 1.5;

    const accepted = await this.prisma.follow.findMany({
      where: { followerId: viewerId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    const followingIds = accepted.map((f) => f.followingId);
    const friendIds = followingIds.length ? followingIds : ['__none__'];

    // Snapshot the clock once and carry it (plus the keyset) in the cursor.
    let nowMs: number;
    let cursorScore: number | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      const [n, s, i] = cursor.split('_');
      nowMs = Number(n);
      cursorScore = Number(s);
      cursorId = i ?? null;
    } else {
      nowMs = Date.now();
    }
    const now = new Date(nowMs);

    const rows = await this.prisma.$queryRaw<Array<{ id: string; score: number }>>(
      Prisma.sql`
        SELECT id, score FROM (
          SELECT "id",
            (1 + "likesCount" + 2 * "commentsCount")
              / POWER(
                  EXTRACT(EPOCH FROM (${now}::timestamptz - "createdAt")) / 3600 + 2,
                  ${GRAVITY}
                ) AS score
          FROM "Post"
          WHERE "createdAt" > ${now}::timestamptz - INTERVAL '30 days'
            AND (
              "visibility" = 'PUBLIC'
              OR "authorId" = ${viewerId}
              OR ("visibility" = 'FRIENDS' AND "authorId" = ANY(${friendIds}))
            )
            ${authorId ? Prisma.sql`AND "authorId" = ${authorId}` : Prisma.empty}
        ) ranked
        ${
          cursorScore !== null && cursorId !== null
            ? Prisma.sql`WHERE (score < ${cursorScore} OR (score = ${cursorScore} AND id < ${cursorId}))`
            : Prisma.empty
        }
        ORDER BY score DESC, id DESC
        LIMIT ${FEED_PAGE_SIZE + 1}
      `,
    );

    const hasMore = rows.length > FEED_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;
    const ids = pageRows.map((r) => r.id);
    if (!ids.length) return { items: [], nextCursor: null };

    // Fetch full post payloads, then restore the ranked order.
    const posts = await this.prisma.post.findMany({
      where: { id: { in: ids } },
      include: POST_INCLUDE,
    });
    const byId = new Map(posts.map((p) => [p.id, p]));
    const items = ids
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => this.shapePost(p, viewerId));

    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last ? `${nowMs}_${last.score}_${last.id}` : null;

    return { items, nextCursor };
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

    // A BOOKMARK is a private "save for later" — it must not touch the public
    // like count and must not notify the author.
    const isPublic = kind !== ReactionKind.BOOKMARK;

    const existing = await this.prisma.reaction.findUnique({
      where: { postId_userId_kind: { postId, userId, kind } },
    });

    if (existing) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      if (isPublic) {
        await this.prisma.post.update({
          where: { id: postId },
          data: { likesCount: { decrement: 1 } },
        });
      }
      return { reacted: false };
    }

    await this.prisma.reaction.create({
      data: { postId, userId, kind },
    });
    if (isPublic) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
      });
    }

    if (isPublic && post.authorId !== userId) {
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

    const alreadyNotified = [post.authorId];
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });
      if (parent && parent.authorId !== authorId) {
        alreadyNotified.push(parent.authorId);
        await this.notifications.create({
          userId: parent.authorId,
          actorId: authorId,
          kind: NotificationKind.COMMENT_REPLY,
          targetType: 'COMMENT',
          targetId: parent.id,
        });
      }
    }

    await this.notifyMentions({
      text: dto.body,
      actorId: authorId,
      targetType: 'COMMENT',
      targetId: comment.id,
      excludeUserIds: alreadyNotified,
    });

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
    // Time-decayed tag popularity over the last 14 days: a tag used a lot
    // recently outranks an old one. weight = exp(-ageHours / 72) gives roughly
    // a 2-day half-life so "trending" tracks current activity, not all-time.
    const now = new Date();
    const rows = await this.prisma.$queryRaw<
      Array<{ tag: string; count: bigint }>
    >(Prisma.sql`
      SELECT tag, COUNT(*)::bigint AS count
      FROM (
        SELECT unnest("tags") AS tag,
          EXP(-EXTRACT(EPOCH FROM (${now}::timestamptz - "createdAt")) / 3600 / 72) AS weight
        FROM "Post"
        WHERE "visibility" = 'PUBLIC'
          AND "createdAt" > ${now}::timestamptz - INTERVAL '14 days'
      ) t
      GROUP BY tag
      ORDER BY SUM(weight) DESC
      LIMIT ${limit}
    `);
    return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
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

  /** Pull unique @usernames out of free text (usernames are stored lowercase). */
  private extractMentions(text: string): string[] {
    const matches = text.match(/@([a-z0-9_]{3,30})/gi) ?? [];
    return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
  }

  /**
   * Notify every real user @mentioned in `text`, skipping the actor and anyone
   * already notified for this action (post/comment author, parent author).
   */
  private async notifyMentions(opts: {
    text: string;
    actorId: string;
    targetType: 'POST' | 'COMMENT';
    targetId: string;
    excludeUserIds?: string[];
  }): Promise<void> {
    const usernames = this.extractMentions(opts.text);
    if (!usernames.length) return;

    const exclude = new Set([opts.actorId, ...(opts.excludeUserIds ?? [])]);
    const users = await this.prisma.user.findMany({
      where: { username: { in: usernames } },
      select: { id: true },
    });

    await Promise.all(
      users
        .filter((u) => !exclude.has(u.id))
        .map((u) =>
          this.notifications.create({
            userId: u.id,
            actorId: opts.actorId,
            kind: NotificationKind.MENTION,
            targetType: opts.targetType,
            targetId: opts.targetId,
          }),
        ),
    );
  }
}
