import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceTrackingService } from './device-tracking.service';
import { UserDevice } from '../../../entities/user-device.entity';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UsersModule } from '../../users/users.module';
import { ConfigModule } from '../../config/config.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice, SessionHistory]),
    forwardRef(() => UsersModule),
  ConfigModule,
  forwardRef(() => NotificationsModule),
  ],
  providers: [DeviceTrackingService],
  exports: [DeviceTrackingService],
})
export class DeviceTrackingModule {}
