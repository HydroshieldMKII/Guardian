import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const MAX_TEMPORARY_ACCESS_MINUTES = 10 * 365 * 24 * 60;
const MAX_BATCH_DEVICES = 500;

export class TemporaryAccessDto {
  @IsInt()
  @Min(1)
  @Max(MAX_TEMPORARY_ACCESS_MINUTES)
  durationMinutes: number;

  @IsOptional()
  @IsBoolean()
  bypassPolicies?: boolean;
}

export class BatchTemporaryAccessDto extends TemporaryAccessDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BATCH_DEVICES)
  @IsInt({ each: true })
  @Min(1, { each: true })
  deviceIds: number[];
}
