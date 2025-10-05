import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionHistory } from '../../../entities/session-history.entity';
import { UserDevice } from '../../../entities/user-device.entity';
import { ActiveSessionService } from './active-session.service';
import { DeviceTrackingModule } from '../../devices/services/device-tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionHistory, UserDevice]),
    DeviceTrackingModule,
  ],
  providers: [ActiveSessionService],
  exports: [ActiveSessionService],
})
export class ActiveSessionModule {}
