import type { PortalDevice, PortalSettings, PortalUserRules } from "@/types";

const NETWORK_POLICY_LABEL: Record<string, string> = {
  both: "Local network and internet",
  lan: "Local network only",
  wan: "Internet only",
};

export const networkPolicyLabel = (policy: string): string =>
  NETWORK_POLICY_LABEL[policy] ?? NETWORK_POLICY_LABEL.both;

export const streamLimitLabel = (limit: number): string =>
  limit === 0 ? "Unlimited" : `${limit} stream${limit > 1 ? "s" : ""}`;

export const restrictedIPs = (rules: PortalUserRules): string[] =>
  rules.ipAccessPolicy === "restricted" ? (rules.allowedIPs ?? []) : [];

export const canAddNote = (
  device: PortalDevice,
  settings: PortalSettings | null,
): boolean =>
  !device.requestSubmittedAt &&
  (device.status === "pending" ||
    (device.status === "rejected" && Boolean(settings?.allowRejectedRequests)));

export interface PortalNote {
  description: string;
  submittedAt: string;
  readAt: string | null;
}

export const sentNote = (device: PortalDevice): PortalNote | null =>
  device.requestSubmittedAt &&
  device.requestDescription &&
  (device.status === "pending" || device.status === "rejected")
    ? {
        description: device.requestDescription,
        submittedAt: device.requestSubmittedAt,
        readAt: device.requestNoteReadAt ?? null,
      }
    : null;
