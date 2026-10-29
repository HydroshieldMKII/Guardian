import { ConfigService } from '@/modules/config/services/config.service';
import type { DeviceStatus } from '@/entities/user-device.entity';

export type StrictModeStatus = Exclude<DeviceStatus, 'pending'>;

export const isStrictModeEnabled = async (
  configService: ConfigService,
): Promise<boolean> =>
  (await configService.getSetting('PLEX_GUARD_STRICT_MODE')) === true;

export const strictModeStatus = (defaultBlock: boolean): StrictModeStatus =>
  defaultBlock ? 'rejected' : 'approved';
