import { Module, forwardRef } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DeviceTrackingService } from './services/device-tracking.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDevice } from '../../entities/user-device.entity';
import { SessionHistory } from '../../entities/session-history.entity';
import { UsersModule } from '../users/users.module';
import { PlexModule } from '../plex/plex.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice, SessionHistory]),
    forwardRef(() => UsersModule),
    forwardRef(() => PlexModule),
    forwardRef(() => SessionsModule),
    ConfigModule,
  ],
  controllers: [DevicesController],
  providers: [DeviceTrackingService],
  exports: [DeviceTrackingService],
})
export class DevicesModule {}
