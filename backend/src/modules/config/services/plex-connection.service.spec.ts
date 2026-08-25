import { Test } from '@nestjs/testing';
import { EventEmitter } from 'events';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'http';
import { PlexConnectionService } from './plex-connection.service';
import { PlexErrorCode } from '@/types/plex-errors';

const mockHttpRequest = jest.fn();
const mockHttpsRequest = jest.fn();

jest.mock('http', () => ({
  request: (...args: unknown[]) => mockHttpRequest(...args),
}));

jest.mock('https', () => ({
  request: (...args: unknown[]) => mockHttpsRequest(...args),
}));

type ResponseListener = (res: IncomingMessage) => void;

class FakeRequest extends EventEmitter {
  destroy = jest.fn();
  setTimeout = jest.fn();
  end = jest.fn();
}

describe('PlexConnectionService', () => {
  let service: PlexConnectionService;
  let request: FakeRequest;

  const connect = () =>
    service.testConnection('10.0.0.5', '32400', 'plex-token', false, false);

  const optionsOf = (mock: jest.Mock): RequestOptions =>
    mock.mock.calls[0][0] as RequestOptions;

  const respondWith = (res: Partial<IncomingMessage>) => {
    const listener = mockHttpRequest.mock.calls[0][1] as ResponseListener;
    listener(res as IncomingMessage);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    request = new FakeRequest();

    const asClientRequest = (): ClientRequest => {
      const stub: Pick<ClientRequest, 'destroy' | 'setTimeout' | 'end' | 'on'> =
        {
          destroy: request.destroy,
          setTimeout: request.setTimeout,
          end: request.end,
          on: request.on.bind(request),
        };
      return stub as ClientRequest;
    };

    mockHttpRequest.mockImplementation(() => asClientRequest());
    mockHttpsRequest.mockImplementation(() => asClientRequest());

    const module = await Test.createTestingModule({
      providers: [PlexConnectionService],
    }).compile();

    service = module.get(PlexConnectionService);
  });

  describe('configuration guard', () => {
    it.each([
      ['ip', ['', '32400', 'token']],
      ['port', ['10.0.0.5', '', 'token']],
      ['token', ['10.0.0.5', '32400', '']],
    ] as const)('refuses to dial with no %s', async (_field, args) => {
      const [ip, port, token] = args;
      const result = await service.testConnection(
        ip,
        port,
        token,
        false,
        false,
      );

      expect(result).toMatchObject({
        success: false,
        errorCode: PlexErrorCode.NOT_CONFIGURED,
      });
      expect(mockHttpRequest).not.toHaveBeenCalled();
      expect(mockHttpsRequest).not.toHaveBeenCalled();
    });
  });

  describe('request shape', () => {
    it('dials plain http when SSL is off', async () => {
      const pending = connect();
      respondWith({ statusCode: 200 });
      await pending;

      expect(mockHttpsRequest).not.toHaveBeenCalled();
      expect(optionsOf(mockHttpRequest)).toMatchObject({
        hostname: '10.0.0.5',
        port: '32400',
        method: 'GET',
      });
    });

    it('carries the token as a query parameter', async () => {
      const pending = connect();
      respondWith({ statusCode: 200 });
      await pending;

      expect(optionsOf(mockHttpRequest).path).toBe('/?X-Plex-Token=plex-token');
    });

    it('verifies certificates unless asked not to', async () => {
      const pending = connect();
      respondWith({ statusCode: 200 });
      await pending;

      expect(optionsOf(mockHttpRequest)).toMatchObject({
        rejectUnauthorized: true,
      });
    });

    it('skips verification when certificate errors are ignored', async () => {
      const pending = service.testConnection(
        '10.0.0.5',
        '32400',
        'plex-token',
        true,
        true,
      );
      const listener = mockHttpsRequest.mock.calls[0][1] as ResponseListener;
      listener({ statusCode: 200 } as IncomingMessage);
      await pending;

      expect(mockHttpRequest).not.toHaveBeenCalled();
      expect(optionsOf(mockHttpsRequest)).toMatchObject({
        rejectUnauthorized: false,
      });
    });

    it('bounds the request with a ten second timeout', async () => {
      const pending = connect();
      respondWith({ statusCode: 200 });
      await pending;

      expect(optionsOf(mockHttpRequest).timeout).toBe(10000);
      expect(request.setTimeout).toHaveBeenCalledWith(10000);
      expect(request.end).toHaveBeenCalled();
    });
  });

  describe('server responses', () => {
    it('reports success on a 200', async () => {
      const pending = connect();
      respondWith({ statusCode: 200 });

      await expect(pending).resolves.toMatchObject({
        success: true,
        message: 'Successfully connected to Plex server',
      });
    });

    it('blames the token on a 401', async () => {
      const pending = connect();
      respondWith({ statusCode: 401, statusMessage: 'Unauthorized' });

      await expect(pending).resolves.toMatchObject({
        success: false,
        errorCode: PlexErrorCode.AUTH_FAILED,
        details: 'HTTP 401: Unauthorized',
      });
    });

    it.each([500, 404, 302])('reports a %s as a server error', async (code) => {
      const pending = connect();
      respondWith({ statusCode: code, statusMessage: 'Nope' });

      await expect(pending).resolves.toMatchObject({
        success: false,
        errorCode: PlexErrorCode.SERVER_ERROR,
      });
    });
  });

  describe('transport failures', () => {
    const failWith = async (error: NodeJS.ErrnoException) => {
      const pending = connect();
      request.emit('error', error);
      return pending;
    };

    const errno = (code: string, message = 'failed') =>
      Object.assign(new Error(message), { code });

    it('recognises a hostname mismatch on the certificate', async () => {
      await expect(
        failWith(errno('ERR_TLS_CERT_ALTNAME_INVALID')),
      ).resolves.toMatchObject({ errorCode: PlexErrorCode.CERT_ERROR });
    });

    it('recognises any other TLS failure', async () => {
      await expect(
        failWith(errno('ERR_TLS_HANDSHAKE_TIMEOUT')),
      ).resolves.toMatchObject({ errorCode: PlexErrorCode.SSL_ERROR });
    });

    it.each(['ECONNREFUSED', 'EHOSTUNREACH'])(
      'reports %s as unreachable',
      async (code) => {
        await expect(failWith(errno(code))).resolves.toMatchObject({
          errorCode: PlexErrorCode.CONNECTION_REFUSED,
        });
      },
    );

    it.each(['ECONNRESET', 'ETIMEDOUT'])(
      'reports %s as a timeout',
      async (code) => {
        await expect(failWith(errno(code))).resolves.toMatchObject({
          errorCode: PlexErrorCode.CONNECTION_TIMEOUT,
        });
      },
    );

    it('reads a timeout out of the message when there is no code', async () => {
      await expect(
        failWith(new Error('socket timeout reached')),
      ).resolves.toMatchObject({
        errorCode: PlexErrorCode.CONNECTION_TIMEOUT,
      });
    });

    it('falls back to a generic network error', async () => {
      await expect(
        failWith(errno('EPIPE', 'broken pipe')),
      ).resolves.toMatchObject({
        errorCode: PlexErrorCode.NETWORK_ERROR,
        details: 'broken pipe',
      });
    });

    it('gives up and destroys the socket on a timeout event', async () => {
      const pending = connect();
      request.emit('timeout');

      await expect(pending).resolves.toMatchObject({
        errorCode: PlexErrorCode.CONNECTION_REFUSED,
      });
      expect(request.destroy).toHaveBeenCalled();
    });

    it('reports a synchronous failure as an unknown error', async () => {
      mockHttpRequest.mockImplementation(() => {
        throw new Error('module exploded');
      });

      await expect(connect()).resolves.toMatchObject({
        errorCode: PlexErrorCode.UNKNOWN_ERROR,
        details: 'module exploded',
      });
    });
  });
});
