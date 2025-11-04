import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { config, isDevelopment } from './config/app.config';
import { DeviceTrackingService } from './modules/devices/services/device-tracking.service';
import { SessionTerminationService } from './modules/plex/services/session-termination.service';
import { NotificationOrchestratorService } from './modules/notifications/services/notification-orchestrator.service';
import * as dotenv from 'dotenv';
import * as path from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';

// Load environment variables
if (isDevelopment()) {
  dotenv.config({ path: path.join(process.cwd(), '../.env') });
} else {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
  app.use(cookieParser());

  app.enableCors({
    origin: (_origin, callback) => {
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie'],
    credentials: true,
    optionsSuccessStatus: 200,
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  app.use(helmet());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Event listeners
  const deviceTrackingService = app.get(DeviceTrackingService);
  const sessionTerminationService = app.get(SessionTerminationService);
  const notificationOrchestrator = app.get(NotificationOrchestratorService);

  deviceTrackingService.onNewDeviceDetected((event) => {
    void notificationOrchestrator.notifyNewDevice(event);
  });

  sessionTerminationService.onStreamBlocked((event) => {
    void notificationOrchestrator.notifyStreamBlocked(event);
  });

  await app.listen(config.app.port);

  console.log(`Server is running on port ${config.app.port}`);

  const cleanup = () => {
    console.log('Shutting down server...');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
void bootstrap();
