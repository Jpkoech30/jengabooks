import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  userId!: string;

  @IsString()
  @IsIn(['TASK_ASSIGNED', 'COMMENT_MENTION', 'DEADLINE_REMINDER', 'SYSTEM'])
  type!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsString()
  @IsIn(['IN_APP', 'EMAIL', 'SMS', 'ALL'])
  channel?: string;

  @IsOptional()
  @IsString()
  relatedEntityType?: string;

  @IsOptional()
  @IsString()
  relatedEntityId?: string;
}
