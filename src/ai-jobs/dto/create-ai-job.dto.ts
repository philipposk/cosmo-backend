import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAIJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  prompt!: string;

  // Bounded short values — these are styling hints, not free instructions.
  // Length caps shrink the prompt-injection surface (the provider also
  // strips newlines before splicing them into the system prompt).
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  genre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  safetyLevel?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  modelIdentifier!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  @ArrayMaxSize(15)
  tags?: string[];
}
