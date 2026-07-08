import { IsString } from 'class-validator';

export class CreateVersionDto {
  @IsString()
  documentId!: string;
}
