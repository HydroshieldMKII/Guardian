import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TimeOfDay } from '@/modules/users/dto/time-of-day.decorator';

export class CreateTimeRuleBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceIdentifier?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  ruleName: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @TimeOfDay()
  startTime: string;

  @TimeOfDay()
  endTime: string;
}
