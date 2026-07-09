import { IsString, Matches, IsOptional } from 'class-validator';

/**
 * DTO for validating a supplier KRA PIN.
 *
 * The KRA PIN format is 11 uppercase alphanumeric characters.
 * Mixed-case input is accepted and normalized to uppercase by the service.
 */
export class ValidatePinDto {
  /**
   * The supplier's KRA PIN.
   * Must be exactly 11 alphanumeric characters (case-insensitive).
   */
  @IsString({ message: 'kraPin must be a string' })
  @Matches(/^[A-Za-z0-9]{11}$/, {
    message: 'kraPin must be exactly 11 alphanumeric characters',
  })
  kraPin!: string;

  /**
   * Optional supplier/business name for display in the response.
   */
  @IsOptional()
  @IsString({ message: 'supplierName must be a string' })
  supplierName?: string;
}
