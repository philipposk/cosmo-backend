import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { STORY_STATUS_VALUES } from '../../stories/story.constants';
import type { StoryStatusValue } from '../../stories/story.constants';

export class ModerationTagDto {
  @IsString()
  key!: string;

  @IsString()
  value!: string;
}

export class ModerateStoryDto {
  @IsIn(['APPROVED', 'FLAGGED', 'REMOVED'])
  decision!: 'APPROVED' | 'FLAGGED' | 'REMOVED';

  @IsOptional()
  @IsIn(STORY_STATUS_VALUES)
  statusOverride?: StoryStatusValue;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModerationTagDto)
  tags?: ModerationTagDto[];
}
