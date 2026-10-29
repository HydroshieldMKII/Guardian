import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GlobalExceptionFilter } from '@/filters/global-exception.filter';
import { callArgs } from '@/test-matchers';
import type { Mock } from 'vitest';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let status: Mock;
  let json: Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    filter = new GlobalExceptionFilter();
    json = vi.fn();
    status = vi.fn().mockReturnValue({ json });

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/api/things', method: 'GET' }),
      }),
    } as ArgumentsHost;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const captured = (): Record<string, unknown> =>
    callArgs<[Record<string, unknown>]>(json)[0];

  it('preserves the status of an HttpException', () => {
    filter.catch(new HttpException('Nope', HttpStatus.FORBIDDEN), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
  });

  it('falls back to 500 for an unknown error', () => {
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('falls back to 500 for a non-Error throwable', () => {
    filter.catch('just a string', host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured().message).toBe('Internal server error');
  });

  it('echoes the request path and method', () => {
    filter.catch(new Error('boom'), host);
    expect(captured()).toMatchObject({ path: '/api/things', method: 'GET' });
  });

  it('includes a timestamp', () => {
    filter.catch(new Error('boom'), host);
    expect(captured().timestamp).toBeInstanceOf(Date);
  });

  it('passes a string exception response straight through', () => {
    filter.catch(
      new HttpException('Plain message', HttpStatus.BAD_REQUEST),
      host,
    );
    expect(captured().message).toBe('Plain message');
  });

  it('unwraps the message from an object exception response', () => {
    filter.catch(new BadRequestException('Validation failed'), host);
    expect(captured().message).toBe('Validation failed');
  });

  it('keeps a validation error array intact', () => {
    filter.catch(
      new BadRequestException(['a must be set', 'b must be set']),
      host,
    );
    expect(captured().message).toEqual(['a must be set', 'b must be set']);
  });

  it('reports unknown error for an object response with no message', () => {
    filter.catch(
      new HttpException({ code: 'X' }, HttpStatus.BAD_REQUEST),
      host,
    );
    expect(captured().message).toBe('Unknown error');
  });

  it('logs a server failure as an error', () => {
    const log = vi.spyOn(Logger.prototype, 'error');
    filter.catch(new Error('boom'), host);
    expect(log).toHaveBeenCalled();
  });

  it('logs a client error as a warning', () => {
    const error = vi.spyOn(Logger.prototype, 'error');
    const warn = vi.spyOn(Logger.prototype, 'warn');
    filter.catch(new BadRequestException('Validation failed'), host);
    expect(warn).toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  const parserError = (
    message: string,
    fields: { status: number; expose: boolean },
  ) => Object.assign(new Error(message), fields);

  it('keeps the status of an exposed body parser error', () => {
    filter.catch(
      parserError('request entity too large', { status: 413, expose: true }),
      host,
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(captured().message).toBe('request entity too large');
  });

  it('hides an error that is not marked as exposed', () => {
    filter.catch(parserError('secret', { status: 400, expose: false }), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured().message).toBe('Internal server error');
  });

  it('ignores an exposed status outside the client error range', () => {
    filter.catch(parserError('upstream', { status: 502, expose: true }), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
