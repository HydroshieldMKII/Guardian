import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlexService } from './services/plex.service';
import { PlexClient } from './services/plex-client';
import { SessionTerminationService } from './services/session-termination.service';
import { UserDevice } from '../../entities/user-device.entity';
import { SessionHistory } from '../../entities/session-history.entity';
import { DevicesModule } from '../devices/devices.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { ConfigModule } from '../config/config.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice, SessionHistory]),
    forwardRef(() => DevicesModule),
    forwardRef(() => SessionsModule),
    forwardRef(() => UsersModule),
    ConfigModule,
    forwardRef(() => NotificationsModule),
  ],
  providers: [PlexService, PlexClient, SessionTerminationService],
  exports: [PlexService, PlexClient, SessionTerminationService],
})
export class PlexModule {}
