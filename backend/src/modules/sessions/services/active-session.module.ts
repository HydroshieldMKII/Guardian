import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveSession } from '../../../entities/active-session.entity';
import { ActiveSessionService } from './active-session.service';
import { DeviceTrackingModule } from '../../devices/services/device-tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActiveSession]),
    DeviceTrackingModule,
  ],
  providers: [ActiveSessionService],
  exports: [ActiveSessionService],
})
export class ActiveSessionModule {}
