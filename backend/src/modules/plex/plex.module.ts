import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlexService } from './services/plex.service';
import { PlexClient } from './services/plex-client';
import { SessionTerminationService } from './services/session-termination.service';
import { UserDevice } from '../../entities/user-device.entity';
import { DevicesModule } from '../devices/devices.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice]),
    DevicesModule,
    SessionsModule,
  ],
  providers: [PlexService, PlexClient, SessionTerminationService],
  exports: [PlexService, PlexClient, SessionTerminationService],
})
export class PlexModule {}
