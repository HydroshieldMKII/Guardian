import { Global, Module } from '@nestjs/common';
import { EventsController } from '@/modules/events/events.controller';
import { LiveEventsService } from '@/modules/events/live-events.service';

@Global()
@Module({
  controllers: [EventsController],
  providers: [LiveEventsService],
  exports: [LiveEventsService],
})
export class EventsModule {}
