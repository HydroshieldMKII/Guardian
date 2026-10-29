import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { ConfigService } from '@/modules/config/services/config.service';

const OFFSET_PATTERN = /^([+-])(\d{2}):(\d{2})$/;
const MINUTE_MS = 60 * 1000;

const formatInOffset = (date: Date, offset: string): string => {
  const match = offset.match(OFFSET_PATTERN);
  if (!match) {
    return date.toISOString();
  }

  const [, sign, hours, minutes] = match;
  const offsetMs =
    (sign === '+' ? 1 : -1) *
    (Number(hours) * 60 + Number(minutes)) *
    MINUTE_MS;
  const shifted = new Date(date.getTime() + offsetMs);
  return `${shifted.toISOString().slice(0, 19).replace('T', ' ')} ${offset}`;
};

@Injectable()
export class TemporaryAccessService {
  private readonly logger = new Logger(TemporaryAccessService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    private configService: ConfigService,
  ) {}

  async grantTemporaryAccess(
    deviceId: number,
    durationMinutes: number,
    bypassPolicies: boolean = false,
  ): Promise<void> {
    const grantedAt = new Date();
    const expiresAt = new Date(
      grantedAt.getTime() + durationMinutes * MINUTE_MS,
    );

    const result = await this.userDeviceRepository.update(deviceId, {
      temporaryAccessUntil: expiresAt,
      temporaryAccessGrantedAt: grantedAt,
      temporaryAccessDurationMinutes: durationMinutes,
      temporaryAccessBypassPolicies: bypassPolicies,
    });
    if (!result.affected) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    const timezoneOffset = await this.configService.getTimezone();
    this.logger.log(
      `Granted temporary access to device ${deviceId} for ${durationMinutes} minutes (expires at ${formatInOffset(expiresAt, timezoneOffset)})`,
    );
  }

  async revokeTemporaryAccess(deviceId: number): Promise<void> {
    await this.userDeviceRepository.update(deviceId, {
      temporaryAccessUntil: null,
      temporaryAccessGrantedAt: null,
      temporaryAccessDurationMinutes: null,
      temporaryAccessBypassPolicies: false,
    });

    this.logger.log(`Revoked temporary access for device ${deviceId}`);
  }

  async isTemporaryAccessValid(device: UserDevice): Promise<boolean> {
    if (!device.temporaryAccessUntil) {
      return false;
    }

    const isValid = device.temporaryAccessUntil > new Date();

    if (!isValid) {
      await this.revokeTemporaryAccess(device.id);
      this.logger.log(
        `Temporary access expired for device ${device.id}, cleaned up`,
      );
    }

    return isValid;
  }

  getTemporaryAccessTimeLeft(device: UserDevice): number | null {
    if (!device.temporaryAccessUntil) {
      return null;
    }

    const timeLeft = device.temporaryAccessUntil.getTime() - Date.now();

    return timeLeft > 0 ? Math.ceil(timeLeft / MINUTE_MS) : 0;
  }
}
