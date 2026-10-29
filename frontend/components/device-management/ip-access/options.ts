import { getNetworkType } from "@/lib/ipUtils";
import type { UserDevice, UserPreference } from "@/types";

export type NetworkPolicy = UserPreference["networkPolicy"];
export type IPAccessPolicy = UserPreference["ipAccessPolicy"];

export interface PolicyOption<Value extends string> {
  value: Value;
  title: string;
  description: string;
}

export const NETWORK_TYPE_LABEL: Record<
  ReturnType<typeof getNetworkType>,
  string
> = {
  lan: "local network",
  wan: "internet",
  unknown: "unrecognised address",
};

export const NETWORK_OPTIONS: PolicyOption<NetworkPolicy>[] = [
  {
    value: "both",
    title: "Local network and internet",
    description: "Allow streaming from anywhere, at home or away.",
  },
  {
    value: "lan",
    title: "Local network only",
    description:
      "Allow streaming only from a device on the same network as the Plex server.",
  },
  {
    value: "wan",
    title: "Internet only",
    description:
      "Allow streaming only from a device outside the Plex server's network.",
  },
];

export const IP_OPTIONS: PolicyOption<IPAccessPolicy>[] = [
  {
    value: "all",
    title: "Any address",
    description: "Allow streaming from any IP address.",
  },
  {
    value: "restricted",
    title: "Only listed addresses",
    description:
      "Allow streaming only from the IP addresses and address ranges you list below.",
  },
];

export type DeviceWithIP = UserDevice & { ipAddress: string };

export const devicesWithIP = (devices: UserDevice[]) =>
  devices.filter((device): device is DeviceWithIP => Boolean(device.ipAddress));
