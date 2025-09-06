import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PlexService } from './plex/plex.service';
import { PlexClient } from './plex/plex-client';
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
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: "*",
    methods: '*',
    allowedHeaders: '*',
    credentials: true,
    optionsSuccessStatus: 200,
  });

  await app.listen(config.app.port);

  const plexClient = app.get(PlexClient);
  const {ok, status} = await plexClient.testConnection();

  const plexService = app.get(PlexService);

  if (!ok) {
    console.error(`❌ Direct connection to Plex server failed with status: ${status}. Exiting...`);
    process.exit(1);
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
    console.log('Shutting down PlexGuard server...');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
bootstrap();
