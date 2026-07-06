import { IsUUID } from 'class-validator';

export class SwitchCompanyDto {
  @IsUUID('4', { message: 'Invalid company ID format' })
  companyId!: string;
}
