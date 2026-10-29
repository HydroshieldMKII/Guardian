import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class BatchTimeRulesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds: string[];
}
