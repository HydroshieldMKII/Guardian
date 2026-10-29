import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TIME_RULE_PRESETS } from '@/modules/users/services/time-rule-presets';
import type { TimeRulePreset } from '@/modules/users/services/time-rule-presets';

export class TimeRulePresetBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceIdentifier?: string;

  @IsIn(TIME_RULE_PRESETS)
  presetType: TimeRulePreset;
}
