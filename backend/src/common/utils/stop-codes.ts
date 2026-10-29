export type StopCode =
  | 'DEVICE_PENDING'
  | 'DEVICE_REJECTED'
  | 'IP_POLICY_LAN_ONLY'
  | 'IP_POLICY_WAN_ONLY'
  | 'IP_POLICY_NOT_ALLOWED'
  | 'TIME_RESTRICTED'
  | 'CONCURRENT_LIMIT';

interface StopCodeText {
  reason: string;
  description: string;
}

const STOP_CODE_TEXT: Record<StopCode, StopCodeText> = {
  DEVICE_PENDING: {
    reason: 'device needs approval',
    description:
      'A streaming session was blocked because the device requires administrator approval',
  },
  DEVICE_REJECTED: {
    reason: 'device is not allowed',
    description:
      'A streaming session was blocked because the device has been explicitly rejected',
  },
  IP_POLICY_LAN_ONLY: {
    reason: 'device attempted WAN access but is restricted to LAN only',
    description:
      'A streaming session was blocked because the device attempted external access but is restricted to local network only',
  },
  IP_POLICY_WAN_ONLY: {
    reason: 'device attempted LAN access but is restricted to WAN only',
    description:
      'A streaming session was blocked because the device attempted local access but is restricted to external connections only',
  },
  IP_POLICY_NOT_ALLOWED: {
    reason: 'IP address is not in the allowed list',
    description:
      'A streaming session was blocked because the device IP address is not in the approved access list',
  },
  TIME_RESTRICTED: {
    reason: "user schedule doesn't allow streaming at this moment",
    description:
      'A streaming session was blocked due to time-based scheduling restrictions',
  },
  CONCURRENT_LIMIT: {
    reason: 'user exceeded concurrent stream limit',
    description:
      'A streaming session was blocked because the user has reached their concurrent stream limit',
  },
};

export const GENERIC_BLOCK_DESCRIPTION =
  'A streaming session has been blocked on your Plex server';

export const stopCodeReason = (stopCode: StopCode): string =>
  STOP_CODE_TEXT[stopCode].reason;

export const describeStopCode = (stopCode?: StopCode): string =>
  stopCode ? STOP_CODE_TEXT[stopCode].description : GENERIC_BLOCK_DESCRIPTION;
