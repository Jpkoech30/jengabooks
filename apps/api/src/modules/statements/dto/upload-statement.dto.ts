import { IsOptional, IsString, IsIn } from 'class-validator';

export class UploadStatementDto {
  @IsOptional()
  @IsString()
  @IsIn(['MPESA', 'KCB', 'EQUITY', 'COOP', 'SCB', 'OTHER'], {
    message: 'Institution must be one of: MPESA, KCB, EQUITY, COOP, SCB, OTHER',
  })
  institution?: string;
}

export class ListUploadsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
