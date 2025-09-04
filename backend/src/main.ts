import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PlexService } from './plex/plex.service';
import { DeviceTrackingService } from './services/device-tracking.service';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { spawn } from 'child_process';
import { config } from './config/app.config';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

let proxyProcess: ReturnType<typeof spawn> | null = null;
let intervalId: NodeJS.Timeout | null = null;

async function bootstrap() {
  proxyProcess = spawn('npx', ['ts-node', 'src/proxy/proxy-server.ts'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  });

  await new Promise((res) => setTimeout(res, 2000));

  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: config.cors.origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(config.app.port);

  const plexService = app.get(PlexService);

  try {
    const deviceTrackingService = app.get(DeviceTrackingService);
    await deviceTrackingService.initializeDeviceStatuses();
  } catch (error) {
    console.error('Failed to initialize device statuses:', error);
  }

  intervalId = setInterval(async () => {
    try {
      await plexService.updateActiveSessions();
    } catch (err: any) {
      console.error('Error fetching sessions:', err.message);
    }
  }, config.plex.refreshInterval * 1000);

  const cleanup = () => {
    if (intervalId) clearInterval(intervalId);
    if (proxyProcess) proxyProcess.kill();
    console.log('Shutting down proxy and exiting...');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
bootstrap();
