import { Chip, PillRow, Section } from "@/components/ui/entity";
import { getNetworkType } from "@/lib/ipUtils";
import { NETWORK_TYPE_LABEL, type DeviceWithIP } from "./options";

export function StreamingAddresses({
  name,
  devices,
}: {
  name: string;
  devices: DeviceWithIP[];
}) {
  return (
    <Section title={`Addresses ${name} is streaming from`}>
      <PillRow>
        {devices.map((device) => (
          <Chip key={device.deviceIdentifier} tone="info">
            <span className="max-w-[140px] truncate font-sans">
              {device.deviceName || device.deviceIdentifier}
            </span>
            <span>{device.ipAddress}</span>
            <span className="font-sans opacity-70">
              {NETWORK_TYPE_LABEL[getNetworkType(device.ipAddress)]}
            </span>
          </Chip>
        ))}
      </PillRow>
    </Section>
  );
}
