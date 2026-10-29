import { SettingValueField } from '@/modules/config/dto/setting-value.decorator';

export class UpdateSettingDto {
  @SettingValueField()
  value: string | number | boolean;
}
