import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

const exposedClientStatus = (exception: unknown): number | undefined =>
  exception instanceof Error &&
  'expose' in exception &&
  exception.expose === true &&
  'status' in exception &&
  typeof exception.status === 'number' &&
  exception.status >= 400 &&
  exception.status < 500
    ? exception.status
    : undefined;

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const clientStatus = exposedClientStatus(exception);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (clientStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : clientStatus !== undefined && exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date(),
      path: request.url,
      method: request.method,
      message:
        typeof message === 'string'
          ? message
          : typeof message === 'object' &&
              message !== null &&
              'message' in message
            ? (message as { message: string }).message
            : 'Unknown error',
    };

    const summary = `${request.method} ${request.url} - ${status} - ${
      exception instanceof Error ? exception.message : 'Unknown error'
    }`;

    if (status < 500) {
      this.logger.warn(summary);
    } else {
      this.logger.error(
        summary,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(errorResponse);
  }
}
