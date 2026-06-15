import { IsIn } from 'class-validator';
import { STORY_VISIBILITY_VALUES } from '../story.constants';
import type { StoryVisibilityValue } from '../story.constants';

export class UpdateStoryVisibilityDto {
  @IsIn(STORY_VISIBILITY_VALUES)
  visibility!: StoryVisibilityValue;
}
