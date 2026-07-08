import { IsString, IsNotEmpty, IsNumber, IsDateString, IsEnum, IsArray, IsOptional, Min } from 'class-validator';

export class CreateLockDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsNumber()
  @Min(2020)
  fiscalYear!: number;

  @IsDateString()
  @IsNotEmpty()
  periodStart!: string;

  @IsDateString()
  @IsNotEmpty()
  periodEnd!: string;

  @IsEnum(['FULL', 'MODULE_SPECIFIC', 'ROLE_BASED'])
  lockType!: 'FULL' | 'MODULE_SPECIFIC' | 'ROLE_BASED';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modules?: string[];
}
