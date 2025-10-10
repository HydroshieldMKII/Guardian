import { Module, forwardRef } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { ActiveSessionService } from './services/active-session.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionHistory } from '../../entities/session-history.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { DeviceTrackingModule } from '../devices/services/device-tracking.module';
import { PlexModule } from '../plex/plex.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionHistory, UserDevice]),
    forwardRef(() => DeviceTrackingModule),
    forwardRef(() => PlexModule),
  ],
  controllers: [SessionsController],
  providers: [ActiveSessionService],
  exports: [ActiveSessionService],
})
export class SessionsModule {}
