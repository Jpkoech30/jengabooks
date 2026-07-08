import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'COMPLETED', 'SKIPPED', 'ESCALATED'])
  status?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  assignedToName?: string;
}
