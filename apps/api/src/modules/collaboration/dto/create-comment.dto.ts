import { IsString, IsArray, IsOptional, IsIn, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsIn(['MPESA_TX', 'JOURNAL_ENTRY', 'INVOICE', 'PAYROLL_ENTRY'])
  entityType!: string;

  @IsString()
  entityId!: string;

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
