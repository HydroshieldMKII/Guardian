import { Controller, Get, Post, Param, ParseIntPipe, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { DeviceTrackingService } from './services/device-tracking.service';
import { UserDevice } from '../../entities/user-device.entity';
import { PlexClient } from '../plex/services/plex-client';

@Controller('devices')
export class DevicesController {
  private readonly logger = new Logger(DevicesController.name);

  constructor(
    private readonly deviceTrackingService: DeviceTrackingService, 
    private readonly plexClient: PlexClient,
  ) {}

  @Get()
  async getAllDevices(): Promise<UserDevice[]> {
    return this.deviceTrackingService.getAllDevices();
  }

  @Get('pending')
  async getPendingDevices(): Promise<UserDevice[]> {
    return this.deviceTrackingService.getPendingDevices();
  }

  @Get('processed')
  async getProcessedDevices(): Promise<UserDevice[]> {
    return this.deviceTrackingService.getProcessedDevices();
  }

  @Get('approved')
  async getApprovedDevices(): Promise<UserDevice[]> {
    return this.deviceTrackingService.getApprovedDevices();
  }

  @Post('batch/temporary-access')
  async grantBatchTemporaryAccess(
    @Body() body: { deviceIds: number[], durationMinutes: number },
  ): Promise<{ message: string; results: { deviceId: number; success: boolean; error?: string }[] }> {
    try {
      // Validate request body
      if (!body || !Array.isArray(body.deviceIds) || body.deviceIds.length === 0) {
        throw new HttpException('deviceIds must be a non-empty array', HttpStatus.BAD_REQUEST);
      }

      if (!body.durationMinutes || typeof body.durationMinutes !== 'number' || body.durationMinutes <= 0) {
        throw new HttpException('durationMinutes must be a positive number', HttpStatus.BAD_REQUEST);
      }

      // Validate that all deviceIds are numbers
      for (const deviceId of body.deviceIds) {
        if (typeof deviceId !== 'number' || !Number.isInteger(deviceId) || deviceId <= 0) {
          throw new HttpException(`Invalid device ID: ${deviceId}. All device IDs must be positive integers.`, HttpStatus.BAD_REQUEST);
        }
      }

      this.logger.log(`Granting temporary access to ${body.deviceIds.length} devices for ${body.durationMinutes} minutes`);
      
      const results: { deviceId: number; success: boolean; error?: string }[] = [];
      
      for (const deviceId of body.deviceIds) {
        try {
          await this.deviceTrackingService.grantTemporaryAccess(deviceId, body.durationMinutes);
          results.push({ deviceId, success: true });
          this.logger.log(`Successfully granted temporary access to device ${deviceId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ 
            deviceId, 
            success: false, 
            error: errorMessage
          });
          this.logger.error(`Failed to grant temporary access to device ${deviceId}: ${errorMessage}`);
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      return {
        message: `Temporary access: ${successCount} devices granted, ${failCount} failed`,
        results
      };
    } catch (error) {
      this.logger.error(`Batch temporary access error: ${error.message}`);
      throw error;
    }
  }

  @Post(':id/approve')
  async approveDevice(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.deviceTrackingService.approveDevice(id);
    return { message: `Device ${id} approved successfully` };
  }

  @Post(':id/delete')
  async deleteDevice(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.deviceTrackingService.deleteDevice(id);
    return { message: `Device ${id} deleted successfully` };
  }

  @Post(':id/reject')
  async rejectDevice(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.deviceTrackingService.rejectDevice(id);
    return { message: `Device ${id} rejected and deleted successfully` };
  }

  @Post(':id/rename')
  async renameDevice(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { newName: string },
  ): Promise<{ message: string }> {
    await this.deviceTrackingService.renameDevice(id, body.newName);
    return { message: `Device ${id} renamed successfully` };
  }

  @Post(':id/temporary-access')
  async grantTemporaryAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { durationMinutes: number },
  ): Promise<{ message: string }> {
    await this.deviceTrackingService.grantTemporaryAccess(id, body.durationMinutes);
    return { message: `Temporary access granted to device ${id} for ${body.durationMinutes} minutes` };
  }

  @Post(':id/revoke-temporary-access')
  async revokeTemporaryAccess(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.deviceTrackingService.revokeTemporaryAccess(id);
    return { message: `Temporary access revoked for device ${id}` };
  }

  @Post('revoke/:userId/:deviceIdentifier')
  async revokeDeviceByIdentifier(
    @Param('userId') userId: string,
    @Param('deviceIdentifier') deviceIdentifier: string,
  ): Promise<{ message: string }> {
    const device =
      await this.deviceTrackingService.findDeviceByUserAndIdentifier(
        userId,
        deviceIdentifier,
      );
    if (!device) {
      return { message: 'Device not found' };
    }

    // Revoke any temporary access first
    await this.deviceTrackingService.revokeTemporaryAccess(device.id);
    
    // Then reject the device
    await this.deviceTrackingService.rejectDevice(device.id);

    const sessionKeyToTerminate = device.currentSessionKey;
    
    if (sessionKeyToTerminate) {
      try {
        await this.plexClient.terminateSession(sessionKeyToTerminate);
        this.logger.log(`Successfully terminated session ${sessionKeyToTerminate} for device ${deviceIdentifier}`);
      } catch (error) {
        // Check if it's a 404 error (session already ended or not found)
        if (error.message && error.message.includes('404')) {
          this.logger.warn(
            `Session ${sessionKeyToTerminate} was already terminated or not found (404) - treating as success`
          );
        } else {
          this.logger.error(
            `Failed to terminate session ${sessionKeyToTerminate} for device ${deviceIdentifier}: ${error.message}`
          );
          // Only throw error for non-404 errors
          throw new HttpException(
            `Failed to revoke device access: ${error.message}`, 
            HttpStatus.BAD_REQUEST
          );
        }
      }
    }

    return { message: `Device authorization revoked successfully` };
  }
}
