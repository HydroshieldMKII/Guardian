import { Module, forwardRef } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { ActiveSessionService } from './services/active-session.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveSession } from '../../entities/active-session.entity';
import { SessionHistory } from '../../entities/session-history.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { DeviceTrackingModule } from '../devices/services/device-tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActiveSession, SessionHistory, UserDevice]),
    forwardRef(() => DeviceTrackingModule),
  ],
  controllers: [SessionsController],
  providers: [ActiveSessionService],
  exports: [ActiveSessionService],
})
export class SessionsModule {}
