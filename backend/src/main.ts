import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PlexService } from './modules/plex/services/plex.service';
import { PlexClient } from './modules/plex/services/plex-client';
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

const proxyProcess: ReturnType<typeof spawn> | null = null;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: '*',
    methods: '*',
    allowedHeaders: '*',
    credentials: true,
    optionsSuccessStatus: 200,
  });

  await app.listen(config.app.port);

  const plexClient = app.get(PlexClient);
  const { ok, status } = await plexClient.testConnection();

  if (!ok) {
    console.error(
      `❌ Direct connection to Plex server failed with status: ${status}. Exiting...`,
    );
    process.exit(1);
  } else {
    console.log(
      `✅ Direct connection to Plex server successful with status: ${status}.`,
    );
  }

  console.log(`✅ PlexGuard server is running on port ${config.app.port}`);

  const cleanup = () => {
    console.log('Shutting down Guardian server...');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
bootstrap();
