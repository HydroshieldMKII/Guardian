import { Module, forwardRef } from '@nestjs/common';
import { DevicesController } from '@/modules/devices/devices.controller';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { UsersModule } from '@/modules/users/users.module';
import { PlexModule } from '@/modules/plex/plex.module';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { ConfigModule } from '@/modules/config/config.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice, SessionHistory]),
    forwardRef(() => UsersModule),
    forwardRef(() => PlexModule),
    forwardRef(() => SessionsModule),
    ConfigModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [DevicesController],
  providers: [DeviceTrackingService],
  exports: [DeviceTrackingService],
})
export class DevicesModule {}
