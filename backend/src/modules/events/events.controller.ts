import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AdminOnly } from '@/modules/auth/decorators/admin-only.decorator';
import { LiveEventsService } from '@/modules/events/live-events.service';

@Controller('live')
export class EventsController {
  constructor(private readonly liveEvents: LiveEventsService) {}

  @AdminOnly()
  @Get()
  stream(@Res() res: Response): void {
    this.liveEvents.register(res);
  }
}
