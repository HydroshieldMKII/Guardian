import { IsBoolean } from 'class-validator';

export class ExcludeFromConcurrentLimitDto {
  @IsBoolean()
  exclude: boolean;
}
