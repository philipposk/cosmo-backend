import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ContentCategory, VisibilityLevel } from '../../prisma/generated';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsEnum(ContentCategory)
  category?: ContentCategory;

  @IsOptional()
  @IsEnum(VisibilityLevel)
  visibility?: VisibilityLevel;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];
}

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class ReactDto {
  @IsString()
  @IsIn(['LIKE', 'LOVE', 'INSPIRE', 'TIP', 'BOOKMARK'])
  kind!: 'LIKE' | 'LOVE' | 'INSPIRE' | 'TIP' | 'BOOKMARK';
}
