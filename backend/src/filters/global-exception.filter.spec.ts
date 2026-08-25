import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GlobalExceptionFilter } from '@/filters/global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter = new GlobalExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/api/things', method: 'GET' }),
      }),
    } as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const captured = (): Record<string, unknown> =>
    json.mock.calls[0][0] as Record<string, unknown>;

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

  it('logs the failure', () => {
    const log = jest.spyOn(Logger.prototype, 'error');
    filter.catch(new Error('boom'), host);
    expect(log).toHaveBeenCalled();
  });
});
