import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../common/auth-request.util';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { ForumsService } from './forums.service';
import {
  CreateReplyDto,
  CreateThreadDto,
  UpdateReplyDto,
  UpdateThreadDto,
} from './dto/forum.dto';

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
    @Body() dto: CreateThreadDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.forums.createThread(id, slug, dto);
  }

  @Get('threads/:threadId')
  thread(@Param('threadId') threadId: string) {
    return this.forums.getThread(threadId);
  }

  @Patch('threads/:threadId')
  @UseGuards(AuthenticatedGuard)
  editThread(
    @Req() req: AuthenticatedRequest,
    @Param('threadId') threadId: string,
    @Body() dto: UpdateThreadDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.forums.updateThread(threadId, id, dto);
  }

  @Delete('threads/:threadId')
  @UseGuards(AuthenticatedGuard)
  deleteThread(
    @Req() req: AuthenticatedRequest,
    @Param('threadId') threadId: string,
  ) {
    const user = assertAuthenticatedUser(req);
    return this.forums.removeThread(threadId, user.id, this.roles(user));
  }

  @Post('threads/:threadId/replies')
  @UseGuards(AuthenticatedGuard)
  reply(
    @Req() req: AuthenticatedRequest,
    @Param('threadId') threadId: string,
    @Body() dto: CreateReplyDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.forums.reply(id, threadId, dto);
  }

  @Patch('replies/:replyId')
  @UseGuards(AuthenticatedGuard)
  editReply(
    @Req() req: AuthenticatedRequest,
    @Param('replyId') replyId: string,
    @Body() dto: UpdateReplyDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.forums.updateReply(replyId, id, dto);
  }

  @Delete('replies/:replyId')
  @UseGuards(AuthenticatedGuard)
  deleteReply(
    @Req() req: AuthenticatedRequest,
    @Param('replyId') replyId: string,
  ) {
    const user = assertAuthenticatedUser(req);
    return this.forums.removeReply(replyId, user.id, this.roles(user));
  }

  private roles(user: AuthenticatedUser): string[] {
    return Array.isArray(user.roles) ? (user.roles as string[]) : [];
  }
}
