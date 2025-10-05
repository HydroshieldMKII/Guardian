import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceTrackingService } from './device-tracking.service';
import { UserDevice } from '../../../entities/user-device.entity';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice]),
    forwardRef(() => UsersModule),
  ],
  providers: [DeviceTrackingService],
  exports: [DeviceTrackingService],
})
export class DeviceTrackingModule {}
