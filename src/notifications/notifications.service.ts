import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationKind } from '../prisma/generated';

type CreateInput = {
  userId: string;
  actorId?: string | null;
  kind: NotificationKind;
  targetType?: string | null;
  targetId?: string | null;
  message?: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(input: CreateInput) {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId ?? null,
        kind: input.kind,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        message: input.message ?? null,
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
    this.gateway.emitToUser(input.userId, 'notification', row);
    return row;
  }

  async list(userId: string, opts: { unreadOnly?: boolean }) {
    const items = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(opts.unreadOnly ? { readAt: null } : {}),
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });

    return { items, unreadCount };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    this.gateway.emitToUser(userId, 'notifications:read-all', null);
    return { success: true };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { success: true };
  }
}
