/**
 * Utility functions for handling stop codes and their descriptions
 */
export class StopCodeUtils {
  static getStopCodeDescription(stopCode: string): string {
    switch (stopCode) {
      case 'DEVICE_PENDING':
        return 'A streaming session was blocked because the device requires administrator approval';
      case 'DEVICE_REJECTED':
        return 'A streaming session was blocked because the device has been explicitly rejected';
      case 'IP_POLICY_LAN_ONLY':
        return 'A streaming session was blocked because the device attempted external access but is restricted to local network only';
      case 'IP_POLICY_WAN_ONLY':
        return 'A streaming session was blocked because the device attempted local access but is restricted to external connections only';
      case 'IP_POLICY_NOT_ALLOWED':
        return 'A streaming session was blocked because the device IP address is not in the approved access list';
      case 'TIME_RESTRICTED':
        return 'A streaming session was blocked due to time-based scheduling restrictions';
      default:
        return `A streaming session was blocked: ${stopCode}`;
    }
  }
}
