import {
  hasIPPolicy,
  hasTemporaryAccess,
  isPlexampDevice,
} from "@/lib/device-policies";
import type { UserTimeRule } from "@/types";
import type { UserDeviceGroup } from "../user-group";
import { DetailGroup } from "./DetailGroup";
import { NewDevicesRule } from "./NewDevicesRule";
import {
  countLabel,
  networkLabel,
  streamLimitDescription,
  streamLimitLabel,
} from "./rule-labels";
import { RuleRow } from "./RuleRow";

export function UserRulesGroup({
  group,
  timeRules,
  savingPolicy,
  onSavePolicy,
  onEditStreamLimit,
  onEditSchedule,
  onEditNetworks,
  onGrantTemporaryAccess,
}: {
  group: UserDeviceGroup;
  timeRules?: UserTimeRule[];
  savingPolicy: boolean;
  onSavePolicy: (defaultBlock: boolean | null) => void;
  onEditStreamLimit: () => void;
  onEditSchedule: () => void;
  onEditNetworks: () => void;
  onGrantTemporaryAccess: () => void;
}) {
  const { preference } = group.user;
  const streamLimit = preference?.concurrentStreamLimit;
  const excludedFromLimit = group.devices.filter(
    (device) => device.excludeFromConcurrentLimit,
  ).length;
  const scheduleCount = (timeRules ?? []).filter((rule) => rule.enabled).length;
  const temporaryCount = group.devices.filter(
    (device) => hasTemporaryAccess(device) && !isPlexampDevice(device),
  ).length;

  return (
    <DetailGroup
      title="Rules"
      description="These apply to every device this user owns."
    >
      <NewDevicesRule
        storedPolicy={preference?.defaultBlock ?? null}
        saving={savingPolicy}
        onSave={onSavePolicy}
      />
      <RuleRow
        title="Streams at once"
        description={streamLimitDescription(excludedFromLimit)}
        value={streamLimitLabel(streamLimit)}
        active={streamLimit !== null && streamLimit !== undefined}
        onClick={onEditStreamLimit}
      />
      <RuleRow
        title="Schedule"
        description="Hours when this user is blocked from streaming"
        value={countLabel(scheduleCount, "rule")}
        active={scheduleCount > 0}
        onClick={onEditSchedule}
      />
      <RuleRow
        title="Networks"
        description="Where this user can stream from"
        value={networkLabel(preference)}
        active={hasIPPolicy(preference)}
        onClick={onEditNetworks}
      />
      <RuleRow
        title="Temporary access"
        description="Let blocked devices stream for a limited time"
        value={countLabel(temporaryCount, "device")}
        active={temporaryCount > 0}
        onClick={onGrantTemporaryAccess}
      />
    </DetailGroup>
  );
}
