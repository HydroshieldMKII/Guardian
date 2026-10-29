import { Meta, MetaGrid, PillRow, StatusPill } from "@/components/ui/entity";
import type { PolicyBadge } from "@/lib/device-policies";
import type { UserDevice } from "@/types";
import { ClickableIP, DeviceStatus } from "../SharedComponents";

const WIDE = "col-span-2 sm:col-span-3";

export const localTime = (value: string) => new Date(value).toLocaleString();

export function DeviceOverview({
  device,
  policies,
}: {
  device: UserDevice;
  policies: PolicyBadge[];
}) {
  return (
    <MetaGrid className="sm:grid-cols-3">
      <Meta label="User">{device.username || device.userId}</Meta>
      <Meta label="Platform">{device.devicePlatform || "Unknown"}</Meta>
      <Meta label="Product">{device.deviceProduct || "Unknown"}</Meta>
      <Meta label="Version">{device.deviceVersion || "Unknown"}</Meta>
      <Meta label="IP address">
        <ClickableIP ipAddress={device.ipAddress} />
      </Meta>
      <Meta label="Streams started">{device.sessionCount}</Meta>
      <Meta label="First seen">{localTime(device.firstSeen)}</Meta>
      <Meta label="Last seen">{localTime(device.lastSeen)}</Meta>
      <Meta label="Status">
        <DeviceStatus device={device} />
      </Meta>
      <Meta label="Enforced policies" wrap className={WIDE}>
        {policies.length === 0 ? (
          <span className="text-muted-foreground">
            None. This device streams without restriction.
          </span>
        ) : (
          <PillRow>
            {policies.map(({ policy, label, tone, hint }) => (
              <StatusPill key={policy} tone={tone} hint={hint}>
                {label}
              </StatusPill>
            ))}
          </PillRow>
        )}
      </Meta>
      <Meta label="Identifier" wrap className={WIDE}>
        <span className="font-mono text-xs">{device.deviceIdentifier}</span>
      </Meta>
    </MetaGrid>
  );
}
