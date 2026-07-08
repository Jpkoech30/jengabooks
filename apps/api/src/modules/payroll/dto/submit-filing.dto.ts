import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class SubmitFilingDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['PAYE', 'NHIF', 'NSSF', 'HOUSING_LEVY'], {
    message: 'type must be one of: PAYE, NHIF, NSSF, HOUSING_LEVY',
  })
  type!: 'PAYE' | 'NHIF' | 'NSSF' | 'HOUSING_LEVY';
}
