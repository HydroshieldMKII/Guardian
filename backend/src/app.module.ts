import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsModule } from './sessions/sessions.module';
import { DeviceTrackingModule } from './services/device-tracking.module';
import { PlexModule } from './plex/plex.module';
import { DevicesModule } from './devices/devices.module';
import { UserDevice } from './entities/user-device.entity';
import { ActiveSession } from './entities/active-session.entity';
import { config } from './config/app.config';
import * as path from 'path';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: path.join(process.cwd(), config.database.path),
      entities: [UserDevice, ActiveSession],
      synchronize: true,
      logging: config.database.logging,
    }),
    SessionsModule,
    DeviceTrackingModule,
    PlexModule,
    DevicesModule,
  ],
})
export class AppModule {}
