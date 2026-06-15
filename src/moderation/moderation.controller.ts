import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { ModerateStoryDto } from './dto/moderate-story.dto';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@Controller('moderation')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('ADMIN', 'MOD')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('stories/flagged')
  listFlaggedStories() {
    return this.moderationService.listFlaggedStories();
  }

  @Patch('stories/:id')
  moderateStory(@Param('id') id: string, @Body() dto: ModerateStoryDto) {
    return this.moderationService.moderateStory(id, dto);
  }
}
