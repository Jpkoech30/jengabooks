import { IsString, IsNotEmpty, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class Amendment {
  @IsString()
  @IsNotEmpty()
  @IsIn(['LEDGER', 'MPESA', 'ETIMS', 'PAYROLL'])
  module!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['lock', 'unlock'])
  action!: 'lock' | 'unlock';
}

export class AmendLockDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Amendment)
  amendments!: Amendment[];
}
