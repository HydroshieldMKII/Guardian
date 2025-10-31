import { NestFactory } from '@nestjs/core';
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

const proxyProcess: ReturnType<typeof spawn> | null = null;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);

    const isDev = isDevelopment();
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
    ];

    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow any localhost origin
    if (isDev && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
      return callback(null, true);
    }

    if (isDev) {
      return callback(null, true); // Allow all in development
    }

    callback(new Error('Not allowed by CORS'));
  };

  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie'],
    credentials: true,
    optionsSuccessStatus: 200,
  });

  app.use(helmet());
  app.useGlobalFilters(new GlobalExceptionFilter());

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
