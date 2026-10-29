import { StatusPill, type Tone } from "@/components/ui/entity";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { BYPASSED_BY_TEMPORARY_ACCESS } from "@/lib/device-policies";
import { formatTimeLeft } from "@/lib/duration";
import type { DeviceStatus, PortalDevice } from "@/types";

const STATUS_BADGES: Record<
  DeviceStatus,
  { tone: Tone; label: string; hint: string }
> = {
  approved: {
    tone: "positive",
    label: "Approved",
    hint: "The server owner has approved this device. You can stream on it.",
  },
  rejected: {
    tone: "danger",
    label: "Rejected",
    hint: "The server owner has blocked this device. You cannot stream on it.",
  },
  pending: {
    tone: "warning",
    label: "Pending",
    hint: "The server owner has not reviewed this device yet.",
  },
};

function TemporaryAccessBadge({
  until,
  bypassPolicies,
}: {
  until: string;
  bypassPolicies: boolean;
}) {
  const timeLeft = formatTimeLeft(until);

  return (
    <HintTooltip
      hint={
        <div className="space-y-1">
          <p className="font-medium">Temporary access granted</p>
          <p className="text-sm">Time remaining: {timeLeft}</p>
          {bypassPolicies && (
            <p className="text-sm">
              While it lasts, {BYPASSED_BY_TEMPORARY_ACCESS} do not apply to
              this device.
            </p>
          )}
        </div>
      }
      screenReaderHint={`Temporary access expires in ${timeLeft}`}
    >
      <StatusPill
        dot
        tone={bypassPolicies ? "accent" : "info"}
        className="cursor-help"
      >
        Temporary access
      </StatusPill>
    </HintTooltip>
  );
}

export function PortalStatusBadge({ device }: { device: PortalDevice }) {
  if (device.hasTemporaryAccess && device.temporaryAccessUntil) {
    return (
      <TemporaryAccessBadge
        until={device.temporaryAccessUntil}
        bypassPolicies={Boolean(device.temporaryAccessBypassPolicies)}
      />
    );
  }

  const badge = STATUS_BADGES[device.status];
  const hint =
    device.status === "pending" && device.requestSubmittedAt
      ? `${badge.hint} Your note has been sent to them.`
      : badge.hint;

  return (
    <StatusPill dot tone={badge.tone} hint={hint}>
      {badge.label}
    </StatusPill>
  );
}
