import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
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

  console.log(`✅ Guardian server is running on port ${config.app.port}`);
  console.log(`🔧 Configure Plex settings through the web interface to get started`);

  const cleanup = () => {
    console.log('Shutting down Guardian server...');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
bootstrap();
