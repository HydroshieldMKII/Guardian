import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DeviceTrackingModule } from '../services/device-tracking.module';

@Module({
  imports: [DeviceTrackingModule],
  controllers: [DevicesController],
})
export class DevicesModule {}
