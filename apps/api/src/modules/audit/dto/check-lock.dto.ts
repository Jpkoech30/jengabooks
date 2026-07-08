import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CheckLockDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsDateString()
  @IsNotEmpty()
  date!: string;
}
