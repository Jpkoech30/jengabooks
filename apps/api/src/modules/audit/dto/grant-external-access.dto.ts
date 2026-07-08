import { IsString, IsNotEmpty, IsEmail, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';

export class GrantExternalAccessDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  recipientName!: string;

  @IsEmail()
  @IsOptional()
  recipientEmail?: string;

  @IsEnum(['READ_ONLY', 'VIEW_ONLY', 'RUN_REPORTS'])
  accessLevel!: 'READ_ONLY' | 'VIEW_ONLY' | 'RUN_REPORTS';

  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays!: number;

  @IsEnum(['ANNUAL_AUDIT', 'LOAN_APPLICATION', 'KRA_AUDIT', 'OTHER'])
  purpose!: 'ANNUAL_AUDIT' | 'LOAN_APPLICATION' | 'KRA_AUDIT' | 'OTHER';
}
