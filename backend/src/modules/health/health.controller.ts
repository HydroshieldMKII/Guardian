import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  private readonly startTime = new Date();

  @Get()
  check() {
    const now = new Date();
    const uptimeMs = now.getTime() - this.startTime.getTime();
    
    return {
      status: 'ok',
      timestamp: now.toISOString(),
      service: 'guardian-backend',
      uptime: {
        milliseconds: uptimeMs,
        seconds: Math.floor(uptimeMs / 1000),
        startTime: this.startTime.toISOString(),
      },
    };
  }
}
