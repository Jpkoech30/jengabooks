import { IsString, IsOptional, IsArray, IsIn, MinLength } from 'class-validator';

export const DOCUMENT_CATEGORIES = [
  'BANK_STATEMENT',
  'RECEIPT',
  'INVOICE',
  'TAX_DOC',
  'CONTRACT',
  'FINANCIAL_REPORT',
  'PAYROLL_REPORT',
  'OTHER',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export class UploadDocumentDto {
  @IsString()
  companyId!: string;

  @IsString()
  @IsIn(DOCUMENT_CATEGORIES)
  category!: DocumentCategory;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
