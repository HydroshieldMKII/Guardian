import type { Tone } from "@/components/ui/entity";
import { formatTimeLeft } from "@/lib/duration";
import type { UserDevice, UserPreference, UserTimeRule } from "@/types";

export type DevicePolicy = "temporary" | "schedule" | "ip";

export interface PolicyBadge {
  policy: DevicePolicy;
  label: string;
  tone: Tone;
  title: string;
}

const POLICY_TONE: Record<DevicePolicy, Tone> = {
  temporary: "positive",
  schedule: "info",
  ip: "accent",
};

const POLICY_LABEL: Record<DevicePolicy, string> = {
  temporary: "Temporary Access",
  schedule: "Time Schedule",
  ip: "IP Access",
};

const POLICY_ORDER: DevicePolicy[] = ["temporary", "schedule", "ip"];

const GROUP_TITLE: Record<DevicePolicy, string> = {
  temporary: "At least one device has temporary access",
  schedule: "A time schedule applies to at least one device",
  ip: "Network and IP access rules apply to this user",
};

const DEVICE_TITLE: Record<Exclude<DevicePolicy, "temporary">, string> = {
  schedule:
    "A time schedule blocks streaming from this device during set hours",
  ip: "Network and IP access rules apply to this device",
};

export const BYPASSED_BY_TEMPORARY_ACCESS =
  "the time schedule, IP access rules and device approval";

export const isPlexampDevice = (device: UserDevice): boolean =>
  Boolean(
    device.deviceProduct?.toLowerCase().includes("plexamp") ||
    device.deviceName?.toLowerCase().includes("plexamp"),
  );

export const hasTemporaryAccess = (device: UserDevice): boolean => {
  if (!device.temporaryAccessUntil) return false;
  return new Date(device.temporaryAccessUntil) > new Date();
};

export const temporaryAccessTimeLeft = (device: UserDevice): string | null =>
  device.temporaryAccessUntil
    ? formatTimeLeft(device.temporaryAccessUntil)
    : null;

export const hasIPPolicy = (preference?: UserPreference | null): boolean => {
  if (!preference) return false;
  const allowed = preference.allowedIPs;
  return (
    preference.networkPolicy !== "both" ||
    preference.ipAccessPolicy !== "all" ||
    (Array.isArray(allowed)
      ? allowed.length > 0
      : String(allowed ?? "").trim() !== "")
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
        title: device.temporaryAccessBypassPolicies
          ? `Temporary access expires in ${timeLeft} and bypasses ${BYPASSED_BY_TEMPORARY_ACCESS}`
          : `Temporary access expires in ${timeLeft}`,
      };
    }

    return {
      policy,
      label: POLICY_LABEL[policy],
      tone: POLICY_TONE[policy],
      title: DEVICE_TITLE[policy],
    };
  });
}

export function groupPolicyBadges(
  devices: UserDevice[],
  preference?: UserPreference | null,
  rules?: UserTimeRule[],
): PolicyBadge[] {
  const present = new Set<DevicePolicy>();
  for (const device of devices) {
    for (const policy of devicePolicies(device, preference, rules)) {
      present.add(policy);
    }
  }

  return POLICY_ORDER.filter((policy) => present.has(policy)).map((policy) => ({
    policy,
    label: POLICY_LABEL[policy],
    tone: POLICY_TONE[policy],
    title: GROUP_TITLE[policy],
  }));
}
