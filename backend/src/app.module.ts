import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionsModule } from './modules/sessions/sessions.module';
import { DevicesModule } from './modules/devices/devices.module';
import { PlexModule } from './modules/plex/plex.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { ConfigModule } from './modules/config/config.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommonModule } from './common/common.module';
import { ServicesModule } from './services/services.module';
import { SchedulerService } from './services/scheduler.service';
import { UserDevice } from './entities/user-device.entity';
import { SessionHistory } from './entities/session-history.entity';
import { UserPreference } from './entities/user-preference.entity';
import { AppSettings } from './entities/app-settings.entity';
import { Notification } from './entities/notification.entity';
import { UserTimeRule } from './entities/user-time-rule.entity';
import { AdminUser } from './entities/admin-user.entity';
import { Session } from './entities/session.entity';
import { config } from './config/app.config';
import * as path from 'path';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database:
        process.env.DATABASE_PATH ||
        path.join(process.cwd(), config.database.path),
      entities: [
        UserDevice,
        SessionHistory,
        UserPreference,
        AppSettings,
        Notification,
        UserTimeRule,
        AdminUser,
        Session,
      ],
      synchronize: true,
      logging: config.database.logging,
      migrations: [path.join(__dirname, 'migrations/*{.ts,.js}')],
      migrationsRun: true,
    }),
    SessionsModule,
    DevicesModule,
    PlexModule,
    HealthModule,
    UsersModule,
    ConfigModule,
    DashboardModule,
    NotificationsModule,
    AuthModule,
    CommonModule,
    ServicesModule,
  ],
  providers: [SchedulerService],
})
export class AppModule {}
