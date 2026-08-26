import { Module } from '@nestjs/common';
import { DashboardController } from '@/modules/dashboard/dashboard.controller';
import { DashboardService } from '@/modules/dashboard/dashboard.service';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { DevicesModule } from '@/modules/devices/devices.module';
import { ConfigModule } from '@/modules/config/config.module';
import { UsersModule } from '@/modules/users/users.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PlexModule } from '@/modules/plex/plex.module';

@Module({
  imports: [
    SessionsModule,
    DevicesModule,
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
