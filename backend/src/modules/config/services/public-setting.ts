import { AppSettings } from '@/entities/app-settings.entity';

export const SECRET_MASK = '••••••••';

export const isSecretMask = (setting: AppSettings, value: string): boolean =>
  setting.private && value === SECRET_MASK;

export const toPublicSetting = (setting: AppSettings): AppSettings => ({
  id: setting.id,
  key: setting.key,
  type: setting.type,
  private: setting.private,
  updatedAt: setting.updatedAt,
  value: setting.private && setting.value ? SECRET_MASK : setting.value,
});
