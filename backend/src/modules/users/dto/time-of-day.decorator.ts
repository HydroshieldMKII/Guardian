import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { TIME_OF_DAY_PATTERN } from '@/common/utils/time-of-day';

export const TimeOfDay = () =>
  applyDecorators(
    IsString(),
    Matches(TIME_OF_DAY_PATTERN, {
      message: '$property must be a time between 00:00 and 23:59 as HH:MM',
    }),
  );
