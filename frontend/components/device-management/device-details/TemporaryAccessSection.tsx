import { Meta, MetaGrid, Section, StatusPill } from "@/components/ui/entity";
import {
  BYPASSED_BY_TEMPORARY_ACCESS,
  hasTemporaryAccess,
} from "@/lib/device-policies";
import { formatMinutes } from "@/lib/duration";
import type { UserDevice } from "@/types";
import { localTime } from "./DeviceOverview";

export const hasTemporaryAccessHistory = (device: UserDevice) =>
  Boolean(
    device.temporaryAccessUntil ||
    device.temporaryAccessGrantedAt ||
    device.temporaryAccessDurationMinutes,
  );

export function TemporaryAccessSection({ device }: { device: UserDevice }) {
  const bypassed = device.temporaryAccessBypassPolicies;

  return (
    <Section title="Temporary access">
      <MetaGrid className="sm:grid-cols-2">
        {device.temporaryAccessDurationMinutes && (
          <Meta label="Duration granted">
            {formatMinutes(device.temporaryAccessDurationMinutes)}
          </Meta>
        )}
        {device.temporaryAccessGrantedAt && (
          <Meta label="Granted at">
            {localTime(device.temporaryAccessGrantedAt)}
          </Meta>
        )}
        {device.temporaryAccessUntil && (
          <Meta
            label={hasTemporaryAccess(device) ? "Expires at" : "Expired at"}
          >
            {localTime(device.temporaryAccessUntil)}
          </Meta>
        )}
        <Meta label="Policy bypass">
          <StatusPill
            tone={bypassed ? "warning" : "neutral"}
            hint={
              bypassed
                ? `While this grant lasts, ${BYPASSED_BY_TEMPORARY_ACCESS} are not enforced against this device`
                : "This grant does not lift any of the user's other policies"
            }
          >
            {bypassed ? "Policies bypassed" : "Policies enforced"}
          </StatusPill>
        </Meta>
      </MetaGrid>
    </Section>
  );
}
