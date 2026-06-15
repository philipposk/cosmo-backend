import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { ForumsService } from './forums.service';

@Controller('forums')
export class ForumsController {
  constructor(private readonly forums: ForumsService) {}

  @Get()
  list() {
    return this.forums.listForums();
  }

  @Get(':slug/threads')
  threads(@Param('slug') slug: string) {
    return this.forums.listThreads(slug);
  }

  @Post(':slug/threads')
  @UseGuards(AuthenticatedGuard)
  createThread(
    @Req() req: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() payload: { title: string; body: string },
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.forums.createThread(id, slug, payload);
  }

  @Get('threads/:threadId')
  thread(@Param('threadId') threadId: string) {
    return this.forums.getThread(threadId);
  }

  @Post('threads/:threadId/replies')
  @UseGuards(AuthenticatedGuard)
  reply(
    @Req() req: AuthenticatedRequest,
    @Param('threadId') threadId: string,
    @Body() payload: { content: string },
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.forums.reply(id, threadId, payload.content);
  }
}
