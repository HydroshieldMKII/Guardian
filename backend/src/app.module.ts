import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsModule } from './modules/sessions/sessions.module';
import { DevicesModule } from './modules/devices/devices.module';
import { PlexModule } from './modules/plex/plex.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { SchedulerService } from './services/scheduler.service';
import { UserDevice } from './entities/user-device.entity';
import { ActiveSession } from './entities/active-session.entity';
import { UserPreference } from './entities/user-preference.entity';
import { config } from './config/app.config';
import * as path from 'path';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || path.join(process.cwd(), config.database.path),
      entities: [UserDevice, ActiveSession, UserPreference],
      synchronize: true,
      logging: config.database.logging,
    }),
    SessionsModule,
    DevicesModule,
    PlexModule,
    HealthModule,
    UsersModule,
  ],
  providers: [SchedulerService],
})
export class AppModule {}
