import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { spawn } from 'child_process';
import { config, isDevelopment } from './config/app.config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

// Load environment variables
if (isDevelopment()) {
  dotenv.config({ path: path.join(process.cwd(), '../.env') });
} else {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: (origin, callback) => {
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie'],
    credentials: true,
    optionsSuccessStatus: 200,
  });

  app.use(helmet());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  await app.listen(config.app.port);

  console.log(`Server is running on port ${config.app.port}`);
  console.log(`CORS enabled for: ${frontendUrl}`);

  const cleanup = () => {
    console.log('Shutting down server...');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
bootstrap();
