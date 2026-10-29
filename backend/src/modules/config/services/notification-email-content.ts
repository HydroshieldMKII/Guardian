import { describeStopCode, StopCode } from '@/common/utils/stop-codes';
import { EMAIL_PALETTE } from '@/common/utils/email-palette';
import { NotificationEmailType } from '@/common/utils/notification-email-type';

export interface NotificationEmailData {
  type: NotificationEmailType;
  text: string;
  username: string;
  deviceName?: string;
  stopCode?: StopCode;
  ipAddress?: string;
  oldIpAddress?: string;
  note?: string;
}

export interface NotificationEmailContent {
  subject: string;
  statusColor: string;
  mainMessage: string;
}

const withDevice = (title: string, deviceName?: string) =>
  `Guardian Alert: ${title}${deviceName ? ` - ${deviceName}` : ''}`;

export const notificationEmailContent = ({
  type,
  stopCode,
  username,
  deviceName,
}: NotificationEmailData): NotificationEmailContent => {
  switch (type) {
    case 'new-device':
      return {
        subject: withDevice('New Device Detected', deviceName),
        statusColor: EMAIL_PALETTE.info,
        mainMessage: `A new device "${deviceName}" has been detected for user "${username}".`,
      };
    case 'location-change':
      return {
        subject: withDevice('Device Location Changed', deviceName),
        statusColor: EMAIL_PALETTE.warning,
        mainMessage: 'A device is streaming from a new location.',
      };
    case 'device-note':
      return {
        subject: withDevice('Device Note Received', deviceName),
        statusColor: EMAIL_PALETTE.accent,
        mainMessage: `User "${username}" has left a note on device "${deviceName}".`,
      };
    case 'block':
    default:
      return {
        subject: withDevice('Stream Blocked', deviceName),
        statusColor: EMAIL_PALETTE.danger,
        mainMessage: describeStopCode(stopCode),
      };
  }
};

export const notificationEmailText = (
  data: NotificationEmailData,
  { subject, mainMessage }: NotificationEmailContent,
  timestamp: string,
): string =>
  [
    `${subject}\n\n${mainMessage}\n`,
    `User: ${data.username}`,
    ...(data.deviceName ? [`Device: ${data.deviceName}`] : []),
    `Type: ${data.type.toUpperCase()}`,
    ...(data.stopCode ? [`Reason: ${data.stopCode}`] : []),
    `\nNotification sent at: ${timestamp}`,
  ].join('\n');
