import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { DeviceEventsService } from '@/modules/devices/services/device-events.service';
import { DevicesService } from '@/modules/devices/services/devices.service';
import { TemporaryAccessService } from '@/modules/devices/services/temporary-access.service';
import { DeviceMaintenanceService } from '@/modules/devices/services/device-maintenance.service';
import { UserDevice } from '@/entities/user-device.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { UsersModule } from '@/modules/users/users.module';
import { ConfigModule } from '@/modules/config/config.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice, SessionHistory]),
    forwardRef(() => UsersModule),
    ConfigModule,
    forwardRef(() => NotificationsModule),
  ],
  providers: [
    DeviceTrackingService,
    DeviceEventsService,
    DevicesService,
    TemporaryAccessService,
    DeviceMaintenanceService,
  ],
  exports: [
    DeviceTrackingService,
    DeviceEventsService,
    DevicesService,
    TemporaryAccessService,
    DeviceMaintenanceService,
  ],
})
export class DeviceTrackingModule {}
