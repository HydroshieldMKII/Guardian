import { Module, forwardRef } from '@nestjs/common';
import { SessionOrchestratorService } from '@/services/session-orchestrator.service';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { DeviceTrackingModule } from '@/modules/devices/services/device-tracking.module';
import { PlexModule } from '@/modules/plex/plex.module';

@Module({
  imports: [
    forwardRef(() => SessionsModule),
    forwardRef(() => DeviceTrackingModule),
    forwardRef(() => PlexModule),
  ],
  providers: [SessionOrchestratorService],
  exports: [SessionOrchestratorService],
})
export class ServicesModule {}
