import { Controller, Get, Post, Param, ParseIntPipe, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { DeviceTrackingService } from './services/device-tracking.service';
import { UserDevice } from '../../entities/user-device.entity';
import { PlexClient } from '../plex/services/plex-client';
import { SessionTerminationService } from '../plex/services/session-termination.service';
import { ActiveSessionService } from '../sessions/services/active-session.service';

@Controller('devices')
export class DevicesController {
  private readonly logger = new Logger(DevicesController.name);

  constructor(
    private readonly deviceTrackingService: DeviceTrackingService, 
    private readonly plexClient: PlexClient,
    private readonly sessionTerminationService: SessionTerminationService,
    private readonly activeSessionService: ActiveSessionService
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
