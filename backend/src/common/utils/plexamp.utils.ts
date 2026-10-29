interface DeviceLabels {
  deviceProduct?: string | null;
  deviceName?: string | null;
}

export const isPlexampDevice = ({
  deviceProduct,
  deviceName,
}: DeviceLabels): boolean =>
  [deviceProduct, deviceName].some((label) =>
    label?.toLowerCase().includes('plexamp'),
  );
