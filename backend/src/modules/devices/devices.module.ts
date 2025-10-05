import { Module, forwardRef } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DeviceTrackingService } from './services/device-tracking.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDevice } from '../../entities/user-device.entity';
import { UsersModule } from '../users/users.module';
import { PlexModule } from '../plex/plex.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserDevice]),
    forwardRef(() => UsersModule),
    forwardRef(() => PlexModule),
  ],
  controllers: [DevicesController],
  providers: [DeviceTrackingService],
  exports: [DeviceTrackingService],
})
export class DevicesModule {}
