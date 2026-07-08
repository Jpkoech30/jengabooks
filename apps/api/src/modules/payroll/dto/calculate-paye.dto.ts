import { IsString, IsNumber, IsOptional, Min, IsNotEmpty } from 'class-validator';

export class CalculatePayeDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsNumber()
  @Min(0)
  grossPay!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  benefitsTotal?: number;

  @IsOptional()
  @IsString()
  payrollRunId?: string;
}
