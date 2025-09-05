import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PlexService } from './plex/plex.service';
import { DeviceTrackingService } from './services/device-tracking.service';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { spawn } from 'child_process';
import { config, isDevelopment } from './config/app.config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
if (isDevelopment()) {
  dotenv.config({ path: path.join(process.cwd(), '../.env') });
} else {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

let proxyProcess: ReturnType<typeof spawn> | null = null;
let intervalId: NodeJS.Timeout | null = null;

async function bootstrap() {
  // Start proxy server
  if (isDevelopment()) {
    proxyProcess = spawn('npx', ['ts-node', 'src/proxy/proxy-server.ts'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
      env: { ...process.env },
    });
  } else {
    proxyProcess = spawn('node', ['dist/proxy/proxy-server.js'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
      env: { ...process.env },
    });
  }

  // Wait for proxy to initialize
  await new Promise((res) => setTimeout(res, 2000));

  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: '*',
    credentials: true,
    optionsSuccessStatus: 200,
  });

  await app.listen(config.app.port);

  const plexService = app.get(PlexService);
  
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
