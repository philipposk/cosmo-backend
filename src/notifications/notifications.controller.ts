import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthenticatedGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query('unread') unread?: string,
    @Query('cursor') cursor?: string,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.notifications.list(id, { unreadOnly: unread === '1', cursor });
  }

  @Patch('read')
  markAll(@Req() req: AuthenticatedRequest) {
    const { id } = assertAuthenticatedUser(req);
    return this.notifications.markAllRead(id);
  }

  @Patch(':id/read')
  markOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = assertAuthenticatedUser(req);
    return this.notifications.markRead(user.id, id);
  }
}
