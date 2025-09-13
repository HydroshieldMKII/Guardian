import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { ActiveSessionService } from './services/active-session.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveSession } from '../../entities/active-session.entity';
import { DeviceTrackingModule } from '../devices/services/device-tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActiveSession]),
    DeviceTrackingModule,
  ],
  controllers: [SessionsController],
  providers: [ActiveSessionService],
  exports: [ActiveSessionService],
})
export class SessionsModule {}
