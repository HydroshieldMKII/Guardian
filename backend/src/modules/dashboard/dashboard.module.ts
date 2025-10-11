import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SessionsModule } from '../sessions/sessions.module';
import { DevicesModule } from '../devices/devices.module';
import { ConfigModule } from '../config/config.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlexModule } from '../plex/plex.module';

@Module({
  imports: [SessionsModule, DevicesModule, ConfigModule, UsersModule, NotificationsModule, PlexModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}