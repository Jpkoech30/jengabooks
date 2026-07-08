import { IsString, IsOptional, IsIn } from 'class-validator';
import { DOCUMENT_CATEGORIES } from './upload-document.dto';

export class QueryDocumentsDto {
  @IsString()
  companyId!: string;

  @IsOptional()
  @IsString()
  @IsIn(DOCUMENT_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
