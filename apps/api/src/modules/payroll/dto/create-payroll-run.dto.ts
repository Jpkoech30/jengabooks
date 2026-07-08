import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreatePayrollRunDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'periodStart must be in YYYY-MM-DD format' })
  periodStart!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'periodEnd must be in YYYY-MM-DD format' })
  periodEnd!: string;
}
