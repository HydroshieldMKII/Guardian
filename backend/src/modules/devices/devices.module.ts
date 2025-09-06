import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DeviceTrackingService } from './services/device-tracking.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDevice } from '../../entities/user-device.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserDevice]), UsersModule],
  controllers: [DevicesController],
  providers: [DeviceTrackingService],
  exports: [DeviceTrackingService],
})
export class DevicesModule {}
