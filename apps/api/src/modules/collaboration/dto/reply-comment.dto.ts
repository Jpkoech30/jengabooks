import { IsString, IsArray, IsOptional, MinLength } from 'class-validator';

export class ReplyCommentDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @IsOptional()
  @IsArray()
  attachments?: { name: string; url: string; type: string }[];
}
