import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceTrackingService } from './device-tracking.service';
import { UserDevice } from '../entities/user-device.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserDevice])],
  providers: [DeviceTrackingService],
  exports: [DeviceTrackingService],
})
export class DeviceTrackingModule {}
