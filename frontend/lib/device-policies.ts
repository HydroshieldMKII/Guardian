import type { Tone } from "@/components/ui/entity";
import { formatTimeLeft } from "@/lib/duration";
import type {
  AppSetting,
  UserDevice,
  UserPreference,
  UserTimeRule,
} from "@/types";

export type DevicePolicy = "temporary" | "schedule" | "ip";

export interface PolicyBadge {
  policy: DevicePolicy;
  label: string;
  tone: Tone;
  hint: string;
}

const POLICY_TONE: Record<DevicePolicy, Tone> = {
  temporary: "positive",
  schedule: "info",
  ip: "accent",
};

const POLICY_LABEL: Record<DevicePolicy, string> = {
  temporary: "Temporary access",
  schedule: "Time schedule",
  ip: "Network access",
};

const DEVICE_HINT: Record<Exclude<DevicePolicy, "temporary">, string> = {
  schedule:
    "A time schedule blocks streaming from this device during set hours",
  ip: "Network and IP access rules apply to this device",
};

export const BYPASSED_BY_TEMPORARY_ACCESS =
  "the time schedule, IP access rules and device approval";

export const isPlexampDevice = (device: UserDevice): boolean =>
  device.deviceProduct?.toLowerCase().includes("plexamp") ?? false;

export const isWaitingDevice = (device: UserDevice): boolean =>
  device.status === "pending" && !isPlexampDevice(device);

export const canGrantTemporaryAccess = (
  device: UserDevice,
  preference: UserPreference | undefined,
  settings: AppSetting[] = [],
): boolean => {
  if (isPlexampDevice(device)) return false;
  if (device.status === "rejected") return true;
  if (device.status !== "pending") return false;
  if (preference && preference.defaultBlock !== null) {
    return preference.defaultBlock !== false;
  }
  return (
    settings.find((setting) => setting.key === "PLEX_GUARD_DEFAULT_BLOCK")
      ?.value !== "false"
  );
};

export const countWaitingDevices = (
  devices: UserDevice[],
  users: UserPreference[] = [],
): number => {
  const hidden = new Set(
    users.filter((user) => user.hidden).map((user) => user.userId),
  );
  return devices.filter(
    (device) => isWaitingDevice(device) && !hidden.has(device.userId),
  ).length;
};

export const hasTemporaryAccess = (device: UserDevice): boolean => {
  if (!device.temporaryAccessUntil) return false;
  return new Date(device.temporaryAccessUntil) > new Date();
};

export const temporaryAccessTimeLeft = (device: UserDevice): string | null =>
  device.temporaryAccessUntil
    ? formatTimeLeft(device.temporaryAccessUntil)
    : null;

export const hasAllowList = (allowed: unknown): boolean =>
  Array.isArray(allowed)
    ? allowed.length > 0
    : typeof allowed === "string" && allowed.trim() !== "";

export const hasIPPolicy = (preference?: UserPreference | null): boolean => {
  if (!preference) return false;
  return (
    preference.networkPolicy !== "both" ||
    preference.ipAccessPolicy !== "all" ||
    hasAllowList(preference.allowedIPs)
  );
};

export const hasTimeSchedule = (
  rules: UserTimeRule[] | undefined,
  deviceIdentifier?: string,
): boolean =>
  (rules ?? []).some(
    (rule) =>
      rule.enabled &&
      (!rule.deviceIdentifier || rule.deviceIdentifier === deviceIdentifier),
  );

export const isPolicyBypassed = (device: UserDevice): boolean =>
  hasTemporaryAccess(device) && Boolean(device.temporaryAccessBypassPolicies);

export function devicePolicies(
  device: UserDevice,
  preference?: UserPreference | null,
  rules?: UserTimeRule[],
): DevicePolicy[] {
  if (isPlexampDevice(device)) return [];

  const policies: DevicePolicy[] = [];
  if (hasTemporaryAccess(device)) policies.push("temporary");
  if (isPolicyBypassed(device)) return policies;

  if (hasTimeSchedule(rules, device.deviceIdentifier))
    policies.push("schedule");
  if (hasIPPolicy(preference)) policies.push("ip");

  return policies;
}

export function devicePolicyBadges(
  device: UserDevice,
  preference?: UserPreference | null,
  rules?: UserTimeRule[],
): PolicyBadge[] {
  return devicePolicies(device, preference, rules).map((policy) => {
    if (policy === "temporary") {
      const timeLeft = temporaryAccessTimeLeft(device);
      return {
        policy,
        label: POLICY_LABEL.temporary,
        tone: POLICY_TONE.temporary,
        hint: device.temporaryAccessBypassPolicies
          ? `Temporary access expires in ${timeLeft} and bypasses ${BYPASSED_BY_TEMPORARY_ACCESS}`
          : `Temporary access expires in ${timeLeft}`,
      };
    }

    return {
      policy,
      label: POLICY_LABEL[policy],
      tone: POLICY_TONE[policy],
      hint: DEVICE_HINT[policy],
    };
  });
}
