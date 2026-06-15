import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { STORY_STATUS_VALUES } from '../story.constants';
import type { StoryStatusValue } from '../story.constants';

export class UpdateStoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  synopsis?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsIn(STORY_STATUS_VALUES)
  status?: StoryStatusValue;
}
