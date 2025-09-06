import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { ActiveSessionService } from './services/active-session.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveSession } from '../../entities/active-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActiveSession])],
  controllers: [SessionsController],
  providers: [ActiveSessionService],
  exports: [ActiveSessionService],
})
export class SessionsModule {}
