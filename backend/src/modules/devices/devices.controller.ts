import { Controller, Get, Post, Param, ParseIntPipe } from '@nestjs/common';
import { DeviceTrackingService } from './services/device-tracking.service';
import { UserDevice } from '../../entities/user-device.entity';
import { PlexClient } from '../plex/services/plex-client';

@Controller('devices')
export class DevicesController {
  constructor(private readonly deviceTrackingService: DeviceTrackingService, private readonly plexClient: PlexClient) {}

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

    await this.deviceTrackingService.rejectDevice(device.id);
    await this.plexClient.terminateSession(device.currentSessionKey);
    return { message: `Device authorization revoked successfully` };
  }
}
