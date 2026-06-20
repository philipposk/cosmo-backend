import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { FeedService } from './feed.service';
import {
  CreateCommentDto,
  CreatePostDto,
  ReactDto,
} from './dto/create-post.dto';

@Controller()
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('feed')
  @UseGuards(AuthenticatedGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('cursor') cursor?: string,
    @Query('author') authorId?: string,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.feed.list(id, { cursor, authorId });
  }

  @Get('feed/trending-tags')
  trending() {
    return this.feed.trendingTags();
  }

  @Post('posts')
  @UseGuards(AuthenticatedGuard)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreatePostDto) {
    const { id } = assertAuthenticatedUser(req);
    return this.feed.create(id, dto);
  }

  @Get('posts/:postId')
  @UseGuards(AuthenticatedGuard)
  get(@Req() req: AuthenticatedRequest, @Param('postId') postId: string) {
    const { id } = assertAuthenticatedUser(req);
    return this.feed.get(postId, id);
  }

  @Delete('posts/:postId')
  @UseGuards(AuthenticatedGuard)
  remove(@Req() req: AuthenticatedRequest, @Param('postId') postId: string) {
    const { id } = assertAuthenticatedUser(req);
    return this.feed.remove(postId, id);
  }

  @Post('posts/:postId/reactions')
  @UseGuards(AuthenticatedGuard)
  react(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
    @Body() dto: ReactDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.feed.react(postId, id, dto);
  }

  @Get('posts/:postId/comments')
  @UseGuards(AuthenticatedGuard)
  comments(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.feed.listComments(postId, id);
  }

  @Post('posts/:postId/comments')
  @UseGuards(AuthenticatedGuard)
  comment(
    @Req() req: AuthenticatedRequest,
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.feed.comment(postId, id, dto);
  }

  @Delete('comments/:commentId')
  @UseGuards(AuthenticatedGuard)
  deleteComment(
    @Req() req: AuthenticatedRequest,
    @Param('commentId') commentId: string,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.feed.removeComment(commentId, id);
  }
}
