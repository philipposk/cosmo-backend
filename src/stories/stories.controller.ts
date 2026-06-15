import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StoriesService } from './stories.service';
import { UpdateStoryDto } from './dto/update-story.dto';
import { UpdateStoryVisibilityDto } from './dto/update-story-visibility.dto';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';

@Controller('stories')
@UseGuards(AuthenticatedGuard)
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  listStories(@Req() req: AuthenticatedRequest) {
    const userId = assertAuthenticatedUser(req).id;
    return this.storiesService.listStoriesForUser(userId);
  }

  @Get(':id')
  getStory(@Req() req: AuthenticatedRequest, @Param('id') storyId: string) {
    const userId = assertAuthenticatedUser(req).id;
    return this.storiesService.getStoryForUser(userId, storyId);
  }

  @Patch(':id')
  updateStory(
    @Req() req: AuthenticatedRequest,
    @Param('id') storyId: string,
    @Body() dto: UpdateStoryDto,
  ) {
    const userId = assertAuthenticatedUser(req).id;
    return this.storiesService.updateStory(userId, storyId, dto);
  }

  @Post(':id/publish')
  publishStory(@Req() req: AuthenticatedRequest, @Param('id') storyId: string) {
    const userId = assertAuthenticatedUser(req).id;
    return this.storiesService.publishStory(userId, storyId);
  }

  @Patch(':id/visibility')
  updateVisibility(
    @Req() req: AuthenticatedRequest,
    @Param('id') storyId: string,
    @Body() dto: UpdateStoryVisibilityDto,
  ) {
    const userId = assertAuthenticatedUser(req).id;
    return this.storiesService.updateVisibility(
      userId,
      storyId,
      dto.visibility,
    );
  }
}
