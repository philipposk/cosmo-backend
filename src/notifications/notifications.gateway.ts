import { Logger, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

const DEFAULT_JWT_SECRET = 'development-jwt-secret';

/**
 * Real-time push for notifications. Clients connect with a `token` auth
 * payload (NextAuth session jwt). Each user gets joined to room `user:<id>`;
 * the NotificationsService broadcasts a `notification` event into that room
 * after persisting a row. Falls back to polling cleanly if Socket.IO is down.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_ORIGIN?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:5176',
    ],
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  onModuleInit(): void {
    this.logger.log('NotificationsGateway initialised');
  }

  handleConnection(client: Socket): void {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const secret = process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      if (typeof payload.sub !== 'string') {
        client.disconnect(true);
        return;
      }
      void client.join(`user:${payload.sub}`);
      client.emit('connected', { userId: payload.sub });
    } catch (err) {
      this.logger.warn(`Socket auth failed: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    // Rooms auto-cleared by socket.io on disconnect; nothing to do.
    this.logger.debug?.(`Socket ${client.id} disconnected`);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
