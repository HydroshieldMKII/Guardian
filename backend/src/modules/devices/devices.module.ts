import { Module, forwardRef } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DeviceTrackingService } from './services/device-tracking.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDevice } from '../../entities/user-device.entity';
import { SessionHistory } from '../../entities/session-history.entity';
import { UsersModule } from '../users/users.module';
import { PlexModule } from '../plex/plex.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice, SessionHistory]),
    forwardRef(() => UsersModule),
    forwardRef(() => PlexModule),
    forwardRef(() => SessionsModule),
  ],
  controllers: [DevicesController],
  providers: [DeviceTrackingService],
  exports: [DeviceTrackingService],
})
export class DevicesModule {}
