import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TimeOfDay } from '@/modules/users/dto/time-of-day.decorator';

export class UpdateTimeRuleBodyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  ruleName?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @TimeOfDay()
  startTime?: string;

  @IsOptional()
  @TimeOfDay()
  endTime?: string;
}
