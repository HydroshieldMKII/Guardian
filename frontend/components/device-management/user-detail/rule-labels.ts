import type { Tone } from "@/components/ui/entity";
import { hasIPPolicy } from "@/lib/device-policies";
import { pluralize } from "@/lib/duration";
import type { UserPreference } from "@/types";

export const POLICY_CHOICES: {
  label: string;
  value: boolean | null;
  tone: Tone;
}[] = [
  { label: "Global", value: null, tone: "neutral" },
  { label: "Allow", value: false, tone: "positive" },
  { label: "Block", value: true, tone: "danger" },
];

const NETWORK_LABEL: Record<UserPreference["networkPolicy"], string> = {
  both: "Any network",
  lan: "Local network only",
  wan: "Internet only",
};

export const streamLimitLabel = (limit?: number | null) => {
  if (limit === null || limit === undefined) return "Global default";
  if (limit === 0) return "Unlimited";
  return String(limit);
};

export const networkLabel = (preference?: UserPreference) => {
  if (!preference || !hasIPPolicy(preference)) return "Anywhere";
  const network = NETWORK_LABEL[preference.networkPolicy];
  return preference.ipAccessPolicy === "restricted"
    ? `${network}, listed addresses`
    : network;
};

export const streamLimitDescription = (excluded: number) =>
  excluded > 0
    ? `How many streams this user can run at the same time. ${pluralize(excluded, "device")} ${excluded === 1 ? "is" : "are"} not counted.`
    : "How many streams this user can run at the same time";

export const countLabel = (count: number, noun: string) =>
  count > 0 ? pluralize(count, noun) : "None";
