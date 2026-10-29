import { StopCode, stopCodeReason } from '@/common/utils/stop-codes';

const MAX_DEVICE_NAME_LENGTH = 30;
const MAX_NOTE_LENGTH = 100;

export const UNKNOWN_DEVICE = 'Unknown Device';

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
  stopCode?: StopCode,
): string => {
  const summary = `Stream blocked for ${username} on ${deviceName}`;
  return stopCode ? `${summary} - ${stopCodeReason(stopCode)}` : summary;
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
