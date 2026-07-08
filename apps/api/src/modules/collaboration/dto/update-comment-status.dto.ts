import { IsString, IsIn } from 'class-validator';

export class UpdateCommentStatusDto {
  @IsString()
  @IsIn(['ACTIVE', 'RESOLVED', 'ESCALATED'])
  status!: string;
}
