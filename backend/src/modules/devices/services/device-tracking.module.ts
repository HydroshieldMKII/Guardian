import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceTrackingService } from './device-tracking.service';
import { UserDevice } from '../../../entities/user-device.entity';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice]),
    UsersModule,
  ],
  providers: [DeviceTrackingService],
  exports: [DeviceTrackingService],
})
export class DeviceTrackingModule {}
