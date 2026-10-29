import { IsInt, Max, Min, ValidateIf } from 'class-validator';

export const MAX_CONCURRENT_STREAM_LIMIT = 1000;

export class UpdateConcurrentStreamLimitDto {
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(MAX_CONCURRENT_STREAM_LIMIT)
  concurrentStreamLimit: number | null;
}
