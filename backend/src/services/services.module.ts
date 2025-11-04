import { Module, forwardRef } from '@nestjs/common';
import { SessionOrchestratorService } from './session-orchestrator.service';
import { SessionsModule } from '../modules/sessions/sessions.module';
import { DevicesModule } from '../modules/devices/devices.module';
import { PlexModule } from '../modules/plex/plex.module';

@Module({
  imports: [
    forwardRef(() => SessionsModule),
    forwardRef(() => DevicesModule),
    forwardRef(() => PlexModule),
  ],
  providers: [SessionOrchestratorService],
  exports: [SessionOrchestratorService],
})
export class ServicesModule {}
