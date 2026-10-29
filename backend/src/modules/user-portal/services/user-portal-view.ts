import { DeviceStatus, UserDevice } from '@/entities/user-device.entity';
import { isPlexampDevice } from '@/common/utils/plexamp.utils';
import { UserTimeRule } from '@/entities/user-time-rule.entity';

export interface UserPortalTimeRule {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  ruleName: string;
  enabled: boolean;
  deviceIdentifier?: string;
}

export interface UserPortalDevice {
  id: number;
  deviceIdentifier: string;
  deviceName: string;
  devicePlatform: string;
  deviceProduct: string;
  status: DeviceStatus;
  firstSeen: Date;
  lastSeen: Date;
  requestDescription?: string | null;
  requestSubmittedAt?: Date | null;
  requestNoteReadAt?: Date | null;
  hasTemporaryAccess: boolean;
  temporaryAccessUntil?: Date | null;
  temporaryAccessBypassPolicies?: boolean | null;
  excludeFromConcurrentLimit: boolean;
  rules?: {
    timeRules: UserPortalTimeRule[];
  };
}

export interface UserPortalUserRules {
  networkPolicy: 'both' | 'lan' | 'wan';
  ipAccessPolicy: 'all' | 'restricted';
  allowedIPs?: string[];
  concurrentStreamLimit: number | null;
  effectiveConcurrentStreamLimit: number;
  defaultBlock: boolean | null;
  effectiveDefaultBlock: boolean;
  timeRules: UserPortalTimeRule[];
}

export const toPortalTimeRule = (rule: UserTimeRule): UserPortalTimeRule => ({
  id: rule.id,
  dayOfWeek: rule.dayOfWeek,
  startTime: rule.startTime,
  endTime: rule.endTime,
  ruleName: rule.ruleName,
  enabled: rule.enabled,
  deviceIdentifier: rule.deviceIdentifier || undefined,
});

export const groupRulesByDevice = (
  rules: UserTimeRule[],
): Map<string, UserPortalTimeRule[]> => {
  const byDevice = new Map<string, UserPortalTimeRule[]>();
  for (const rule of rules) {
    if (!rule.deviceIdentifier) continue;
    const deviceRules = byDevice.get(rule.deviceIdentifier) ?? [];
    deviceRules.push(toPortalTimeRule(rule));
    byDevice.set(rule.deviceIdentifier, deviceRules);
  }
  return byDevice;
};

export const toPortalDevice = (
  device: UserDevice,
  timeRules: UserPortalTimeRule[] | undefined,
  now: Date,
): UserPortalDevice => {
  const hasTemporaryAccess = Boolean(
    device.temporaryAccessUntil && device.temporaryAccessUntil > now,
  );

  return {
    id: device.id,
    deviceIdentifier: device.deviceIdentifier,
    deviceName: device.deviceName || 'Unknown Device',
    devicePlatform: device.devicePlatform || 'Unknown',
    deviceProduct: device.deviceProduct || 'Unknown',
    status: isPlexampDevice(device) ? 'approved' : device.status,
    firstSeen: device.firstSeen,
    lastSeen: device.lastSeen,
    requestDescription: device.requestDescription || undefined,
    requestSubmittedAt: device.requestSubmittedAt || undefined,
    requestNoteReadAt: device.requestNoteReadAt || undefined,
    hasTemporaryAccess,
    temporaryAccessUntil: hasTemporaryAccess
      ? device.temporaryAccessUntil
      : undefined,
    temporaryAccessBypassPolicies: hasTemporaryAccess
      ? device.temporaryAccessBypassPolicies
      : undefined,
    excludeFromConcurrentLimit: device.excludeFromConcurrentLimit,
    rules: timeRules?.length ? { timeRules } : undefined,
  };
};
