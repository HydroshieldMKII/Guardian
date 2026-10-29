import { Button } from "@/components/ui/button";
import { EmptyState, Section, SelectRow } from "@/components/ui/entity";
import { useDeviceUtils } from "@/hooks/device-management/useDeviceUtils";
import type { UserDevice } from "@/types";

interface DeviceSelectionProps {
  devices: UserDevice[];
  selectedIds: number[];
  allSelected: boolean;
  onToggle: (deviceId: number) => void;
  onToggleAll: () => void;
}

export function DeviceSelection({
  devices,
  selectedIds,
  allSelected,
  onToggle,
  onToggleAll,
}: DeviceSelectionProps) {
  const { hasTemporaryAccess } = useDeviceUtils();

  return (
    <Section
      title={`Select devices (${selectedIds.length} selected)`}
      action={
        devices.length > 0 ? (
          <Button variant="outline" size="sm" onClick={onToggleAll}>
            {allSelected ? "Deselect all" : "Select all"}
          </Button>
        ) : undefined
      }
    >
      {devices.length === 0 ? (
        <EmptyState
          title="No devices are eligible for temporary access"
          description="Only devices that are currently blocked can be granted temporary access, meaning devices this user has had rejected, or devices still pending approval while the New devices rule blocks them."
        />
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <SelectRow
              key={device.id}
              selected={selectedIds.includes(device.id)}
              onToggle={() => onToggle(device.id)}
              title={device.deviceName || device.deviceIdentifier}
              subtitle={
                <>
                  {device.devicePlatform} · {device.status}
                  {hasTemporaryAccess(device) && (
                    <span className="ml-2 font-medium text-sky-600 dark:text-sky-400">
                      Already has temporary access
                    </span>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
    </Section>
  );
}
