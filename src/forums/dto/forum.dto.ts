import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Body is required' })
  @MaxLength(20000)
  body!: string;
}

export class UpdateThreadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  body!: string;
}

export class CreateReplyDto {
  @IsString()
  @IsNotEmpty({ message: 'Reply cannot be empty' })
  @MaxLength(10000)
  content!: string;
}

export class UpdateReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content!: string;
}
