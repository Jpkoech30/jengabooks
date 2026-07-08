import { IsString, IsOptional } from 'class-validator';

export class QueryNotificationsDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
