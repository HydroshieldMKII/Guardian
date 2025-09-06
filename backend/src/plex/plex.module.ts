import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlexService } from './plex.service';
import { PlexClient } from './plex-client';
import { StopSessionService } from './stop-session';
import { UserDevice } from '../entities/user-device.entity';
import { DeviceTrackingModule } from '../services/device-tracking.module';
import { ActiveSessionModule } from '../services/active-session.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice]),
    DeviceTrackingModule,
    ActiveSessionModule,
  ],
  providers: [PlexService, PlexClient, StopSessionService],
  exports: [PlexService, PlexClient, StopSessionService],
})
export class PlexModule {}
