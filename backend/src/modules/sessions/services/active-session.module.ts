import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveSession } from '../../../entities/active-session.entity';
import { ActiveSessionService } from './active-session.service';

@Module({
  imports: [TypeOrmModule.forFeature([ActiveSession])],
  providers: [ActiveSessionService],
  exports: [ActiveSessionService],
})
export class ActiveSessionModule {}
