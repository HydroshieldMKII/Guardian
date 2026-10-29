import { ConfigService } from '@/modules/config/services/config.service';
import { isPlexampDevice } from '@/common/utils/plexamp.utils';

export type StrictModeStatus = 'approved' | 'rejected';

export const isStrictModeEnabled = async (
  configService: ConfigService,
): Promise<boolean> =>
  (await configService.getSetting('PLEX_GUARD_STRICT_MODE')) === true;

export const strictModeStatus = (
  device: Parameters<typeof isPlexampDevice>[0],
  defaultBlock: boolean,
): StrictModeStatus =>
  isPlexampDevice(device) || !defaultBlock ? 'approved' : 'rejected';
