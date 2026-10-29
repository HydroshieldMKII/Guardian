import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { DevicesModule } from '@/modules/devices/devices.module';
import { DeviceTrackingModule } from '@/modules/devices/services/device-tracking.module';
import { PlexModule } from '@/modules/plex/plex.module';
import { HealthModule } from '@/modules/health/health.module';
import { UsersModule } from '@/modules/users/users.module';
import { ConfigModule } from '@/modules/config/config.module';
import { DashboardModule } from '@/modules/dashboard/dashboard.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { CommonModule } from '@/common/common.module';
import { ServicesModule } from '@/services/services.module';
import { UserPortalModule } from '@/modules/user-portal/user-portal.module';
import { EventsModule } from '@/modules/events/events.module';
import { SchedulerService } from '@/services/scheduler.service';
import { databaseOptions, databasePath } from '@/database/database.options';
import { initializeDatabase } from '@/database/initialize-database';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseOptions(databasePath()),
      dataSourceFactory: initializeDatabase,
    }),
    SessionsModule,
    DevicesModule,
    DeviceTrackingModule,
    PlexModule,
    HealthModule,
    UsersModule,
    ConfigModule,
    DashboardModule,
    NotificationsModule,
    AuthModule,
    CommonModule,
    ServicesModule,
    UserPortalModule,
    EventsModule,
  ],
  providers: [SchedulerService],
})
export class AppModule {}
