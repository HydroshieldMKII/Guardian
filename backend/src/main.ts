import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { GlobalExceptionFilter } from '@/filters/global-exception.filter';
import { config, isDevelopment } from '@/config/app.config';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';
import { SessionTerminationService } from '@/modules/plex/services/session-termination.service';
import { NotificationOrchestratorService } from '@/modules/notifications/services/notification-orchestrator.service';
import * as dotenv from 'dotenv';
import * as path from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import {
  apiLimiter,
  authLimiter,
  credentialsLimiter,
  passwordResetLimiter,
  trustProxyHops,
} from '@/common/security/rate-limit';

// Load environment variables
if (isDevelopment()) {
  dotenv.config({ path: path.join(process.cwd(), '../.env') });
} else {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', trustProxyHops());

  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
  app.use(cookieParser());

  app.use(helmet());

  app.use('/auth/login', credentialsLimiter());
  app.use('/auth/create-admin', credentialsLimiter());
  app.use('/auth/plex/login', credentialsLimiter());
  app.use('/auth/password-reset/request', passwordResetLimiter());
  app.use('/auth/password-reset/confirm', passwordResetLimiter());
  app.use('/auth', authLimiter());
  app.use(apiLimiter());
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

  deviceTrackingService.onDeviceLocationChanged((event) => {
    void notificationOrchestrator.notifyLocationChange(event);
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
