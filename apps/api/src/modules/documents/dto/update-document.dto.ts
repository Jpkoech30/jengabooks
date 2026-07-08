import { IsString, IsOptional, IsArray, IsIn, MinLength } from 'class-validator';
import { DOCUMENT_CATEGORIES } from './upload-document.dto';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @IsIn(DOCUMENT_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
