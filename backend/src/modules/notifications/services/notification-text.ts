const MAX_DEVICE_NAME_LENGTH = 30;
const MAX_NOTE_LENGTH = 100;

export const UNKNOWN_DEVICE = 'Unknown Device';

const BLOCK_REASONS = new Map<string, string>([
  ['DEVICE_PENDING', 'device needs approval'],
  ['DEVICE_REJECTED', 'device is not allowed'],
  [
    'IP_POLICY_LAN_ONLY',
    'device attempted WAN access but is restricted to LAN only',
  ],
  [
    'IP_POLICY_WAN_ONLY',
    'device attempted LAN access but is restricted to WAN only',
  ],
  ['IP_POLICY_NOT_ALLOWED', 'IP address is not in the allowed list'],
  ['TIME_RESTRICTED', "user schedule doesn't allow streaming at this moment"],
  ['CONCURRENT_LIMIT', 'user exceeded concurrent stream limit'],
]);

const truncate = (text: string, maxLength: number): string =>
  text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;

export const displayDeviceName = (name: string | null | undefined): string =>
  name ? truncate(name, MAX_DEVICE_NAME_LENGTH) : UNKNOWN_DEVICE;

export const newDeviceText = (
  username: string,
  deviceName: string,
  ipAddress: string,
): string =>
  `New device detected for ${username} on ${displayDeviceName(deviceName)} - ${ipAddress}`;

export const streamBlockedText = (
  username: string,
  deviceName: string,
  stopCode?: string,
): string => {
  const summary = `Stream blocked for ${username} on ${deviceName}`;
  return stopCode
    ? `${summary} - ${BLOCK_REASONS.get(stopCode) ?? stopCode}`
    : summary;
};

export const locationChangeText = (
  username: string,
  deviceName: string,
  oldIpAddress: string,
  newIpAddress: string,
): string =>
  `Device location changed for ${username} on ${displayDeviceName(deviceName)} - ${oldIpAddress} → ${newIpAddress}`;

export const deviceNoteText = (
  username: string,
  deviceName: string,
  note: string,
): string =>
  `${username} left a note on ${displayDeviceName(deviceName)}: "${truncate(note, MAX_NOTE_LENGTH)}"`;
