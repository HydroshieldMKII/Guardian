import { StopCode } from '@/common/utils/stop-codes';
import { AppriseNotificationData } from '@/modules/config/services/apprise-cli';

export const newDeviceMessage = (
  username: string,
  deviceName: string,
  ipAddress: string,
): AppriseNotificationData => ({
  title: 'New Device Detected - Guardian',
  body:
    `A new device has been detected:\n\n` +
    `User: ${username}\n` +
    `Device: ${deviceName}\n` +
    `IP Address: ${ipAddress}\n` +
    `Status: Pending Approval\n\n` +
    `Review to approve/reject this device in Guardian.`,
  type: 'warning',
});

export const blockedStreamMessage = (
  username: string,
  deviceName: string,
  ipAddress?: string,
  stopCode?: StopCode,
): AppriseNotificationData => ({
  title: 'Stream Blocked - Guardian',
  body:
    `A stream has been blocked on your server. See details below.\n\n` +
    `User: ${username}\n` +
    `Device: ${deviceName}\n` +
    `IP Address: ${ipAddress || 'Unknown IP Address'}\n` +
    `Stop Code: ${stopCode || 'Unknown Stop Code'}\n\n`,
});

export const locationChangeMessage = (
  username: string,
  deviceName: string,
  oldIpAddress: string,
  newIpAddress: string,
): AppriseNotificationData => ({
  title: 'Device Location Changed - Guardian',
  body:
    `A device location has changed:\n\n` +
    `User: ${username}\n` +
    `Device: ${deviceName}\n` +
    `Old IP Address: ${oldIpAddress}\n` +
    `New IP Address: ${newIpAddress}\n\n` +
    `This could indicate the device is being used from a different location.`,
  type: 'info',
});

export const deviceNoteMessage = (
  username: string,
  deviceName: string,
  note: string,
): AppriseNotificationData => ({
  title: 'Device Note Received - Guardian',
  body:
    `A user has left a note on their device:\n\n` +
    `User: ${username}\n` +
    `Device: ${deviceName}\n` +
    `Note: ${note}\n\n` +
    `Review this device in Guardian to take action.`,
  type: 'info',
});

export const testMessage: AppriseNotificationData = {
  title: 'Guardian Apprise Test',
  body:
    `This is a test notification from Guardian.\n\n` +
    `Apprise integration is working correctly!\n`,
  type: 'info',
};
