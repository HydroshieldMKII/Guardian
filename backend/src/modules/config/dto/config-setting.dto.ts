import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { SettingValueField } from '@/modules/config/dto/setting-value.decorator';
import {
  SETTING_KEYS,
  type SettingKey,
} from '@/modules/config/settings.catalog';

export class ConfigSettingDto {
  @IsString()
  @IsIn(SETTING_KEYS, { message: 'key must be a known setting' })
  key: SettingKey;

  @SettingValueField()
  value: string | number | boolean;

  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'json'])
  type?: 'string' | 'number' | 'boolean' | 'json';

  @IsOptional()
  @IsBoolean()
  private?: boolean;
}
