import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../../../entities/user-device.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UserPreference } from '../../../entities/user-preference.entity';
import { PlexClient } from './plex-client';
import { UsersService } from '../../users/services/users.service';
import { TimePolicyService } from '../../users/services/time-policy.service';
import { ConfigService } from '../../config/services/config.service';
import { DeviceTrackingService } from '../../devices/services/device-tracking.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
  PlexSessionsResponse,
  SessionTerminationResult,
} from '../../../types/plex.types';

@Injectable()
export class SessionTerminationService {
  private readonly logger = new Logger(SessionTerminationService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(SessionHistory)
    private sessionHistoryRepository: Repository<SessionHistory>,
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
    private plexClient: PlexClient,
    private usersService: UsersService,
    private timePolicyService: TimePolicyService,
    @Inject(forwardRef(() => ConfigService))
    private configService: ConfigService,
    @Inject(forwardRef(() => DeviceTrackingService))
    private deviceTrackingService: DeviceTrackingService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  // IP validation utilities
  private isValidIPv4(ip: string): boolean {
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip.trim());
  }

  private isValidCIDR(cidr: string): boolean {
    const cidrRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;
    return cidrRegex.test(cidr.trim());
  }

  private isPrivateIP(ip: string): boolean {
    if (!this.isValidIPv4(ip)) return false;
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 127
    );
  }

  private getNetworkType(ip: string): 'lan' | 'wan' | 'unknown' {
    if (!this.isValidIPv4(ip)) return 'unknown';
    return this.isPrivateIP(ip) ? 'lan' : 'wan';
  }

  private ipToNumber(ip: string): number {
    return (
      ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>>
      0
    );
  }

  private isIPInCIDR(ip: string, cidr: string): boolean {
    if (!this.isValidIPv4(ip) || !this.isValidCIDR(cidr)) return false;
    const [network, prefixLength] = cidr.split('/');
    const ipNum = this.ipToNumber(ip);
    const networkNum = this.ipToNumber(network);
    const mask = (0xffffffff << (32 - parseInt(prefixLength))) >>> 0;
    return (ipNum & mask) === (networkNum & mask);
  }

  private isIPAllowed(clientIP: string, allowedIPs: string[]): boolean {
    if (!this.isValidIPv4(clientIP)) return false;
    if (!allowedIPs.length) return true;

    for (const allowed of allowedIPs) {
      const trimmed = allowed.trim();
      if (this.isValidIPv4(trimmed)) {
        if (clientIP === trimmed) return true;
      } else if (this.isValidCIDR(trimmed)) {
        if (this.isIPInCIDR(clientIP, trimmed)) return true;
      }
    }
    return false;
  }

  private async validateIPAccess(
    session: any,
  ): Promise<{ allowed: boolean; reason?: string; stopCode?: string }> {
    try {
      const userId = session.User?.id || session.User?.uuid;
      const clientIP = session.Player?.address;

      if (!userId) {
        return { allowed: true }; // No user ID, can't validate
      }

      if (!clientIP || !this.isValidIPv4(clientIP)) {
        return {
          allowed: false,
          reason: 'Invalid or missing client IP address from Plex',
        };
      }

      // Get user preferences
      const userPreference = await this.userPreferenceRepository.findOne({
        where: { userId },
      });

      if (!userPreference) {
        return { allowed: true }; // No preferences set, allow access
      }

      const networkPolicy = userPreference.networkPolicy || 'both';
      const ipAccessPolicy = userPreference.ipAccessPolicy || 'all';
      const allowedIPs = userPreference.allowedIPs || [];

      const networkType = this.getNetworkType(clientIP);

      // Check network policy
      if (networkPolicy === 'lan' && networkType !== 'lan') {
        const message =
          ((await this.configService.getSetting(
            'MSG_IP_LAN_ONLY',
          )) as string) || 'Only LAN access is allowed';
        return {
          allowed: false,
          reason: message,
          stopCode: 'IP_POLICY_LAN_ONLY',
        };
      }
      if (networkPolicy === 'wan' && networkType !== 'wan') {
        const message =
          ((await this.configService.getSetting(
            'MSG_IP_WAN_ONLY',
          )) as string) || 'Only WAN access is allowed';
        return {
          allowed: false,
          reason: message,
          stopCode: 'IP_POLICY_WAN_ONLY',
        };
      }

      // Check IP access policy
      if (ipAccessPolicy === 'restricted') {
        if (!this.isIPAllowed(clientIP, allowedIPs)) {
          const message =
            ((await this.configService.getSetting(
              'MSG_IP_NOT_ALLOWED',
            )) as string) ||
            'Your current IP address is not in the allowed list';
          return {
            allowed: false,
            reason: message,
            stopCode: 'IP_POLICY_NOT_ALLOWED',
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      this.logger.error('Error validating IP access', error);
      return { allowed: true }; // Allow on error to be safe
    }
  }

  async stopUnapprovedSessions(
    sessionsData: PlexSessionsResponse,
  ): Promise<SessionTerminationResult> {
    const stoppedSessions: string[] = [];
    const errors: string[] = [];

    try {
      const sessions = sessionsData?.MediaContainer?.Metadata || [];

      if (!sessions || sessions.length === 0) {
        return { stoppedSessions, errors };
      }

      for (const session of sessions) {
        try {
          const shouldStopResult = await this.shouldStopSession(session);

          if (shouldStopResult.shouldStop) {
            const sessionId = session.Session?.id; // Session ID for termination
            const deviceIdentifier =
              session.Player?.machineIdentifier || 'unknown'; // Device identifier for notification lookup
            const sessionKey = session.sessionKey; // Session key for history lookup

            if (sessionId) {
              const username = session.User?.title || 'Unknown';
              const deviceName = session.Player?.title || 'Unknown Device';
              const userId = session.User?.id || 'unknown';
              const reason = shouldStopResult.reason;
              const stopCode = shouldStopResult.stopCode;

              // Terminate the session
              await this.terminateSession(sessionId, reason);
              stoppedSessions.push(sessionId);

              // Create notification for the terminated session
              try {
                const sessionHistory =
                  await this.sessionHistoryRepository.findOne({
                    where: { sessionKey: sessionKey },
                    relations: ['userPreference', 'userDevice'],
                  });

                if (sessionHistory) {
                  this.logger.log(
                    `Found session history with ID: ${sessionHistory.id} for sessionKey: ${sessionKey}`,
                  );
                } else {
                  this.logger.error(
                    `No session history found for sessionKey: ${sessionKey} (device: ${sessionId})`,
                  );
                }

                await this.notificationsService.createStreamBlockedNotification(
                  userId,
                  username,
                  deviceIdentifier,
                  stopCode,
                  sessionHistory?.id,
                );

                this.logger.log(
                  `Created notification for terminated session: ${username} on ${deviceName} (reason: ${reason}, sessionHistoryId: ${sessionHistory?.id || 'null'})`,
                );
              } catch (notificationError) {
                this.logger.error(
                  `Failed to create notification for terminated session ${sessionKey}`,
                  notificationError,
                );
              }
              this.logger.warn(
                `Stopped session: ${session.Session?.id} - Reason: ${reason}`,
              );
              this.logger.warn(
                `Stopped session: ${username} on ${deviceName} (Session: ${sessionId}) - Reason: ${reason}`,
              );
            } else {
              this.logger.warn(
                'Could not find session identifier in session data',
              );

              //
            }
          }
        } catch (error) {
          const sessionKey =
            session.sessionKey || session.Session?.id || 'unknown';
          errors.push(
            `Error processing session ${sessionKey}: ${error.message}`,
          );
          this.logger.error(`Error processing session ${sessionKey}`, error);
        }
      }

      return { stoppedSessions, errors };
    } catch (error) {
      this.logger.error('Error stopping unapproved sessions', error);
      throw error;
    }
  }

  private async shouldStopSession(
    session: any,
  ): Promise<{ shouldStop: boolean; reason?: string; stopCode?: string }> {
    try {
      const userId = session.User?.id || session.User?.uuid;
      const deviceIdentifier = session.Player?.machineIdentifier;

      if (!userId || !deviceIdentifier) {
        this.logger.warn(
          'Session missing user ID or device identifier, cannot determine approval status',
        );
        return { shouldStop: false };
      }

      // If stream is a Plexamp, always allow
      if (session.Player?.product === 'Plexamp') {
        return { shouldStop: false };
      }

      // First, validate IP access policies
      const ipValidation = await this.validateIPAccess(session);
      if (!ipValidation.allowed) {
        this.logger.warn(
          `IP access denied for user ${userId}: ${ipValidation.reason}`,
        );
        return {
          shouldStop: true,
          reason: `${ipValidation.reason}`,
          stopCode: ipValidation.stopCode,
        };
      }
      const isTimeAllowed = await this.timePolicyService.isTimeScheduleAllowed(
        userId,
        deviceIdentifier,
      );
      if (!isTimeAllowed) {
        const timePolicySummary = await this.timePolicyService.getPolicySummary(
          userId,
          deviceIdentifier,
        );
        this.logger.warn(
          `Device ${deviceIdentifier} for user ${userId} is blocked by time policy: ${timePolicySummary}`,
        );

        // Get the configured message or use a detailed default
        const configMessage = (await this.configService.getSetting(
          'MSG_TIME_RESTRICTED',
        )) as string;

        return {
          shouldStop: true,
          reason:
            configMessage ||
            `Streaming is not allowed at this time due to time restrictions (Policy: ${timePolicySummary})`,
          stopCode: 'TIME_RESTRICTED',
        };
      }
      // Check if device is approved
      const device = await this.userDeviceRepository.findOne({
        where: { userId, deviceIdentifier },
      });

      // If device not found or still pending, check for temporary access first
      if (!device || device.status === 'pending') {
        // Check if device has valid temporary access
        if (
          device &&
          (await this.deviceTrackingService.isTemporaryAccessValid(device))
        ) {
          return { shouldStop: false }; // Don't stop - temporary access is valid
        }
        const shouldBlock =
          await this.usersService.getEffectiveDefaultBlock(userId);
        if (shouldBlock) {
          const message =
            ((await this.configService.getSetting(
              'MSG_DEVICE_PENDING',
            )) as string) ||
            'Device Pending Approval. The server owner must approve this device before it can be used.';
          return {
            shouldStop: true,
            reason: message,
            stopCode: 'DEVICE_PENDING',
          };
        }
        return { shouldStop: false };
      }

      if (device.status === 'rejected') {
        // Check if rejected device has valid temporary access
        if (await this.deviceTrackingService.isTemporaryAccessValid(device)) {
          // this.logger.debug(
          //   `Rejected device ${deviceIdentifier} for user ${userId} has valid temporary access, allowing session.`,
          // );
          return { shouldStop: false }; // Don't stop - temporary access overrides rejection
        }

        this.logger.warn(
          `Device ${deviceIdentifier} for user ${userId} is explicitly rejected.`,
        );
        const message =
          ((await this.configService.getSetting(
            'MSG_DEVICE_REJECTED',
          )) as string) ||
          'You are not authorized to use this device. Please contact the server administrator for more information.';
        return {
          shouldStop: true,
          reason: message,
          stopCode: 'DEVICE_REJECTED',
        };
      }

      return { shouldStop: false }; // no terminate if device is approved and time is allowed
    } catch (error) {
      this.logger.error('Error checking session approval status', error);
      return { shouldStop: false }; // Don't stop on error to be safe
    }
  }

  async terminateSession(sessionKey: string, reason?: string): Promise<void> {
    try {
      if (!reason) {
        // Fallback to generic device pending message if no specific reason provided
        reason =
          ((await this.configService.getSetting(
            'MSG_DEVICE_PENDING',
          )) as string) ||
          'This device must be approved by the server owner. Please contact the server administrator for more information.';
      }

      this.logger.log(
        `Terminating session ${sessionKey} with reason: ${reason}`,
      );

      await this.plexClient.terminateSession(sessionKey, reason);
      this.logger.log(`Successfully terminated session ${sessionKey}`);
    } catch (error) {
      this.logger.error(`Failed to terminate session ${sessionKey}`, error);
      throw error;
    }
  }
}
