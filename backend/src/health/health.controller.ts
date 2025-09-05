import { Controller, Get } from '@nestjs/common';
import { config } from '../config/app.config';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'plexguard-backend',
    };
  }

  @Get('cors')
  getCorsConfig() {
    return {
      status: 'ok',
      corsOrigins: config.cors.origins,
      env: {
        NODE_ENV: process.env.NODE_ENV,
      },
    };
  }
}
