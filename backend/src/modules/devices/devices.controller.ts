import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DevicesService } from '@/modules/devices/services/devices.service';
import { TemporaryAccessService } from '@/modules/devices/services/temporary-access.service';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionTerminationService } from '@/modules/plex/services/session-termination.service';
import { AdminOnly } from '@/modules/auth/decorators/admin-only.decorator';
import { errorMessage } from '@/common/utils/error-types';

@Controller('devices')
@AdminOnly()
export class DevicesController {
  private readonly logger = new Logger(DevicesController.name);

  constructor(
    private readonly devicesService: DevicesService,
    private readonly temporaryAccessService: TemporaryAccessService,
    private readonly sessionTermination: SessionTerminationService,
  ) {}

  @Get()
  async getAllDevices(): Promise<UserDevice[]> {
    return this.devicesService.getAllDevices();
  }

  @Get('pending')
  async getPendingDevices(): Promise<UserDevice[]> {
    return this.devicesService.getPendingDevices();
  }

  @Get('processed')
  async getProcessedDevices(): Promise<UserDevice[]> {
    return this.devicesService.getProcessedDevices();
  }

  @Get('approved')
  async getApprovedDevices(): Promise<UserDevice[]> {
    return this.devicesService.getApprovedDevices();
  }

  @Post('batch/temporary-access')
  async grantBatchTemporaryAccess(
    @Body()
    body: {
      deviceIds: number[];
      durationMinutes: number;
      bypassPolicies?: boolean;
    },
  ): Promise<{
    message: string;
    results: { deviceId: number; success: boolean; error?: string }[];
  }> {
    try {
      // Validate request body
      if (
        !body ||
        !Array.isArray(body.deviceIds) ||
        body.deviceIds.length === 0
      ) {
        throw new HttpException(
          'deviceIds must be a non-empty array',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (
        !body.durationMinutes ||
        typeof body.durationMinutes !== 'number' ||
        body.durationMinutes <= 0
      ) {
        throw new HttpException(
          'durationMinutes must be a positive number',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate that all deviceIds are numbers
      for (const deviceId of body.deviceIds) {
        if (
          typeof deviceId !== 'number' ||
          !Number.isInteger(deviceId) ||
          deviceId <= 0
        ) {
          throw new HttpException(
            `Invalid device ID: ${deviceId}. All device IDs must be positive integers.`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      this.logger.log(
        `Granting temporary access to ${body.deviceIds.length} devices for ${body.durationMinutes} minutes`,
      );

      const results: { deviceId: number; success: boolean; error?: string }[] =
        [];

      for (const deviceId of body.deviceIds) {
        try {
          await this.temporaryAccessService.grantTemporaryAccess(
            deviceId,
            body.durationMinutes,
            body.bypassPolicies ?? false,
          );
          results.push({ deviceId, success: true });
          this.logger.log(
            `Successfully granted temporary access to device ${deviceId}`,
          );
        } catch (error) {
          results.push({
            deviceId,
            success: false,
            error: errorMessage(error),
          });
          this.logger.error(
            `Failed to grant temporary access to device ${deviceId}: ${errorMessage(error)}`,
          );
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      return {
        message: `Temporary access: ${successCount} devices granted, ${failCount} failed`,
        results,
      };
    } catch (error) {
      this.logger.error(`Batch temporary access error: ${errorMessage(error)}`);
      throw error;
    }
  }

  @Post(':id/approve')
  async approveDevice(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.devicesService.approveDevice(id);
    return { message: `Device ${id} approved successfully` };
  }

  @Post(':id/delete')
  async deleteDevice(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.devicesService.deleteDevice(id);
    return { message: `Device ${id} deleted successfully` };
  }

  @Post(':id/reject')
  async rejectDevice(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.devicesService.rejectDevice(id);
    return { message: `Device ${id} rejected and deleted successfully` };
  }

  @Post(':id/set-pending')
  async setPendingDevice(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.devicesService.setPendingDevice(id);
    return { message: `Device ${id} set to pending successfully` };
  }

  @Post(':id/rename')
  async renameDevice(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { newName: string },
  ): Promise<{ message: string }> {
    await this.devicesService.renameDevice(id, body.newName);
    return { message: `Device ${id} renamed successfully` };
  }

  @Post(':id/temporary-access')
  async grantTemporaryAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { durationMinutes: number; bypassPolicies?: boolean },
  ): Promise<{ message: string }> {
    await this.temporaryAccessService.grantTemporaryAccess(
      id,
      body.durationMinutes,
      body.bypassPolicies ?? false,
    );
    return {
      message: `Temporary access granted to device ${id} for ${body.durationMinutes} minutes`,
    };
  }

  @Post(':id/revoke-temporary-access')
  async revokeTemporaryAccess(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.temporaryAccessService.revokeTemporaryAccess(id);
    return { message: `Temporary access revoked for device ${id}` };
  }

  @Post(':id/exclude-from-concurrent-limit')
  async updateExcludeFromConcurrentLimit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { exclude: boolean },
  ): Promise<{ message: string }> {
    await this.devicesService.updateExcludeFromConcurrentLimit(
      id,
      body.exclude,
    );
    return {
      message: `Device ${id} ${body.exclude ? 'excluded from' : 'included in'} concurrent stream limit`,
    };
  }

  @Post(':id/mark-note-read')
  async markNoteAsRead(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.devicesService.markNoteAsRead(id);
    return { message: `Note marked as read for device ${id}` };
  }

  @Delete(':id/note')
  async deleteNote(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.devicesService.deleteNote(id);
    return { message: `Note deleted for device ${id}` };
  }

  @Post('revoke/:userId/:deviceIdentifier')
  async revokeDeviceByIdentifier(
    @Param('userId') userId: string,
    @Param('deviceIdentifier') deviceIdentifier: string,
  ): Promise<{ message: string }> {
    const device = await this.devicesService.findDeviceByUserAndIdentifier(
      userId,
      deviceIdentifier,
    );
    if (!device) {
      return { message: 'Device not found' };
    }

    await this.temporaryAccessService.revokeTemporaryAccess(device.id);

    await this.devicesService.rejectDevice(device.id);

    if (device.currentSessionKey) {
      await this.terminateLiveSessions(userId, deviceIdentifier);
    }

    return { message: `Device authorization revoked successfully` };
  }

  private async terminateLiveSessions(
    userId: string,
    deviceIdentifier: string,
  ): Promise<void> {
    try {
      const terminated = await this.sessionTermination.terminateDeviceSessions(
        userId,
        deviceIdentifier,
      );
      this.logger.log(
        `Terminated ${terminated} live session(s) for device ${deviceIdentifier}`,
      );
    } catch (error) {
      if (errorMessage(error).includes('404')) {
        this.logger.warn(
          `Session for device ${deviceIdentifier} had already ended (404) - treating as success`,
        );
        return;
      }
      this.logger.error(
        `Failed to terminate the session for device ${deviceIdentifier}: ${errorMessage(error)}`,
      );
      throw new HttpException(
        `Failed to revoke device access: ${errorMessage(error)}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
