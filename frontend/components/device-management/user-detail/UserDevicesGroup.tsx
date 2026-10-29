import { useDevicePreview } from "@/hooks/device-management/useDevicePreview";
import { devicePolicyBadges } from "@/lib/device-policies";
import type { UserDevice, UserPreference, UserTimeRule } from "@/types";
import { DeviceRow } from "../DeviceRow";
import type { DeviceFocus } from "../user-group";
import { DetailGroup } from "./DetailGroup";

type DeviceAction = (device: UserDevice) => void;

export interface DeviceActions {
  onApprove: DeviceAction;
  onReject: DeviceAction;
  onDelete: DeviceAction;
  onToggleApproval: DeviceAction;
  onRemoveTemporaryAccess: DeviceAction;
  onShowDetails: DeviceAction;
  onDeviceUpdate?: DeviceAction;
}

export function UserDevicesGroup({
  devices,
  preference,
  timeRules,
  deviceFocus,
  actionLoading,
  actions,
}: {
  devices: UserDevice[];
  preference?: UserPreference;
  timeRules?: UserTimeRule[];
  deviceFocus?: DeviceFocus | null;
  actionLoading: number | null;
  actions: DeviceActions;
}) {
  const preview = useDevicePreview(devices, deviceFocus);

  return (
    <DetailGroup title="Devices">
      {devices.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No devices yet. They appear here the first time this user streams.
        </p>
      ) : (
        preview.visible.map((device) => (
          <DeviceRow
            key={device.id}
            device={device}
            policies={devicePolicyBadges(device, preference, timeRules)}
            actionLoading={actionLoading}
            {...actions}
          />
        ))
      )}
      {preview.collapsible && (
        <button
          type="button"
          aria-expanded={preview.showAll}
          onClick={preview.toggle}
          className="w-full cursor-pointer rounded-b-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent/60 hover:text-foreground sm:px-5"
        >
          {preview.showAll
            ? "Show fewer"
            : `Show all ${devices.length} devices`}
        </button>
      )}
    </DetailGroup>
  );
}
