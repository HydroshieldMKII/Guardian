import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SessionsModule } from '../sessions/sessions.module';
import { DevicesModule } from '../devices/devices.module';
import { ConfigModule } from '../config/config.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SessionsModule, DevicesModule, ConfigModule, UsersModule, NotificationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}