import { Module, forwardRef } from '@nestjs/common';
import { SessionsController } from '@/modules/sessions/sessions.controller';
import { ActiveSessionService } from '@/modules/sessions/services/active-session.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionHistory } from '@/entities/session-history.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { DeviceTrackingModule } from '@/modules/devices/services/device-tracking.module';
import { PlexModule } from '@/modules/plex/plex.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionHistory, UserDevice, UserPreference]),
    forwardRef(() => DeviceTrackingModule),
    forwardRef(() => PlexModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [SessionsController],
  providers: [ActiveSessionService],
  exports: [ActiveSessionService],
})
export class SessionsModule {}
