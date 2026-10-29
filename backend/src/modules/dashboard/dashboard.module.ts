import { Module } from '@nestjs/common';
import { DashboardController } from '@/modules/dashboard/dashboard.controller';
import { DashboardService } from '@/modules/dashboard/dashboard.service';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { DeviceTrackingModule } from '@/modules/devices/services/device-tracking.module';
import { ConfigModule } from '@/modules/config/config.module';
import { UsersModule } from '@/modules/users/users.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PlexModule } from '@/modules/plex/plex.module';

@Module({
  imports: [
    SessionsModule,
    DeviceTrackingModule,
    ConfigModule,
    UsersModule,
    NotificationsModule,
    PlexModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
