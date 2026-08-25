import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter } from 'events';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'http';
import { PlexClient } from './plex-client';
import { ConfigService } from '@/modules/config/services/config.service';
import { SessionHistory } from '@/entities/session-history.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { SettingValues } from '@/modules/config/settings.catalog';
import { PlexErrorCode } from '@/types/plex-errors';
import { callArgs } from '@/test-matchers';

const mockHttpRequest = jest.fn<unknown, unknown[]>();
const mockHttpsRequest = jest.fn<unknown, unknown[]>();

jest.mock('http', () => ({
  request: (...args: unknown[]) => mockHttpRequest(...args),
}));

jest.mock('https', () => ({
  request: (...args: unknown[]) => mockHttpsRequest(...args),
}));

class FakeRequest extends EventEmitter {
  destroy = jest.fn();
  setTimeout = jest.fn();
  write = jest.fn();
  end = jest.fn();
}

class FakeResponse extends EventEmitter {
  constructor(
    public statusCode: number | undefined,
    public statusMessage?: string,
  ) {
    super();
  }
}

describe('PlexClient', () => {
  let client: PlexClient;
  let request: FakeRequest;
  let settings: Partial<SettingValues>;

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  const optionsOf = (mock: jest.Mock): RequestOptions =>
    callArgs<[RequestOptions]>(mock)[0];

  const reply = async (
    mock: jest.Mock,
    status: number | undefined,
    body = '',
    statusMessage = 'OK',
  ) => {
    await flush();
    const listener =
      callArgs<[unknown, (res: IncomingMessage) => void]>(mock)[1];
    const res = new FakeResponse(status, statusMessage);
    listener(res as unknown as IncomingMessage);
    if (body) res.emit('data', body);
    res.emit('end');
  };

  const fail = async (error: NodeJS.ErrnoException) => {
    await flush();
    request.emit('error', error);
  };

  const errno = (code: string, message = 'failed') =>
    Object.assign(new Error(message), { code });

  beforeEach(async () => {
    jest.clearAllMocks();
    request = new FakeRequest();

    const asClientRequest = () => {
      const stub: Pick<
        ClientRequest,
        'destroy' | 'setTimeout' | 'write' | 'end' | 'on'
      > = {
        destroy: request.destroy,
        setTimeout: request.setTimeout,
        write: request.write,
        end: request.end,
        on: request.on.bind(request) as ClientRequest['on'],
      };
      return stub as ClientRequest;
    };

    mockHttpRequest.mockImplementation(() => asClientRequest());
    mockHttpsRequest.mockImplementation(() => asClientRequest());

    settings = {
      PLEX_SERVER_IP: '10.0.0.5',
      PLEX_SERVER_PORT: '32400',
      PLEX_TOKEN: 'plex token',
      USE_SSL: false,
      IGNORE_CERT_ERRORS: false,
    };

    const module = await Test.createTestingModule({
      providers: [
        PlexClient,
        {
          provide: ConfigService,
          useValue: {
            getSetting: jest.fn((key: keyof SettingValues) =>
              Promise.resolve(settings[key] ?? null),
            ),
          },
        },
        { provide: getRepositoryToken(SessionHistory), useValue: {} },
        { provide: getRepositoryToken(UserDevice), useValue: {} },
      ],
    }).compile();

    client = module.get(PlexClient);
  });

  describe('configuration guard', () => {
    it.each(['PLEX_SERVER_IP', 'PLEX_SERVER_PORT', 'PLEX_TOKEN'] as const)(
      'refuses to dial with no %s',
      async (key) => {
        settings[key] = '';

        await expect(client.request('/')).rejects.toThrow(
          'Missing required Plex configuration',
        );
        expect(mockHttpRequest).not.toHaveBeenCalled();
      },
    );

    it('guards media requests too', async () => {
      settings.PLEX_TOKEN = '';

      await expect(client.requestMedia('/thumb')).rejects.toThrow(
        'Missing required Plex configuration',
      );
    });
  });

  describe('request', () => {
    it('appends the token to an endpoint with no query', async () => {
      const pending = client.request('status/sessions');
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      expect(optionsOf(mockHttpRequest).path).toBe(
        '/status/sessions?X-Plex-Token=plex%20token',
      );
    });

    it('appends the token to an endpoint that already has a query', async () => {
      const pending = client.request('status/sessions?a=1');
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      expect(optionsOf(mockHttpRequest).path).toBe(
        '/status/sessions?a=1&X-Plex-Token=plex%20token',
      );
    });

    it('tolerates a leading slash on the endpoint', async () => {
      const pending = client.request('/status/sessions');
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      expect(optionsOf(mockHttpRequest).path).toBe(
        '/status/sessions?X-Plex-Token=plex%20token',
      );
    });

    it('identifies itself to Plex', async () => {
      const pending = client.request('/');
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      expect(optionsOf(mockHttpRequest).headers).toMatchObject({
        Accept: 'application/json',
        'X-Plex-Client-Identifier': 'Guardian',
      });
    });

    it('merges caller headers', async () => {
      const pending = client.request('/', { headers: { 'X-Custom': 'yes' } });
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      expect(optionsOf(mockHttpRequest).headers).toMatchObject({
        'X-Custom': 'yes',
      });
    });

    it('dials https when SSL is on', async () => {
      settings.USE_SSL = true;

      const pending = client.request('/');
      await reply(mockHttpsRequest, 200, '{}');
      await pending;

      expect(mockHttpRequest).not.toHaveBeenCalled();
    });

    it('verifies certificates unless told otherwise', async () => {
      const pending = client.request('/');
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      expect(optionsOf(mockHttpRequest)).toMatchObject({
        rejectUnauthorized: true,
      });
    });

    it('skips verification when certificate errors are ignored', async () => {
      settings.IGNORE_CERT_ERRORS = true;

      const pending = client.request('/');
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      expect(optionsOf(mockHttpRequest)).toMatchObject({
        rejectUnauthorized: false,
      });
    });

    it('writes a body when one is given', async () => {
      const pending = client.request('/', { method: 'POST', body: 'payload' });
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      expect(request.write).toHaveBeenCalledWith('payload');
      expect(optionsOf(mockHttpRequest).method).toBe('POST');
    });

    it('sends no body by default', async () => {
      const pending = client.request('/');
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      expect(request.write).not.toHaveBeenCalled();
      expect(optionsOf(mockHttpRequest).method).toBe('GET');
    });

    it('parses a json body', async () => {
      const pending = client.request('/');
      await reply(mockHttpRequest, 200, '{"a":1}');

      const response = await pending;
      expect(response.json()).toEqual({ a: 1 });
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });

    it('returns an empty object for an empty body', async () => {
      const pending = client.request('/');
      await reply(mockHttpRequest, 204);

      await expect(pending).resolves.toMatchObject({ ok: true });
      expect((await pending).json()).toEqual({});
    });

    it('keeps the raw text when the body is not json', async () => {
      const pending = client.request('/');
      await reply(mockHttpRequest, 200, 'not json');

      const response = await pending;
      expect(response.json()).toEqual({});
      expect(response.text()).toBe('not json');
    });

    it.each([400, 401, 500])('rejects a %s response', async (status) => {
      const pending = client.request('/');
      await reply(mockHttpRequest, status, 'nope', 'Bad');

      await expect(pending).rejects.toThrow(`HTTP ${status}`);
    });

    it('rejects a transport failure', async () => {
      const pending = client.request('/');
      await fail(errno('ECONNREFUSED'));

      await expect(pending).rejects.toThrow('failed');
    });

    it('rejects when the server never answers', async () => {
      const pending = client.request('/');
      await flush();
      const [, onTimeout] = request.setTimeout.mock.calls[0] as [
        number,
        () => void,
      ];
      onTimeout();

      await expect(pending).rejects.toThrow('Request timeout');
      expect(request.destroy).toHaveBeenCalled();
    });

    it('bounds the request at fifteen seconds', async () => {
      const pending = client.request('/');
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      expect(callArgs<[number]>(request.setTimeout)[0]).toBe(15000);
    });
  });

  describe('requestMedia', () => {
    const media = () => client.requestMedia('/library/metadata/42/thumb');

    it('collects the body into a buffer', async () => {
      const pending = media();
      await flush();
      const listener = mockHttpRequest.mock.calls[0][1] as (
        res: IncomingMessage,
      ) => void;
      const res = new FakeResponse(200);
      listener(res as unknown as IncomingMessage);
      res.emit('data', Buffer.from([1, 2]));
      res.emit('data', Buffer.from([3]));
      res.emit('end');

      await expect(pending).resolves.toEqual(Buffer.from([1, 2, 3]));
    });

    it('asks for the image without a json Accept header', async () => {
      const pending = media();
      await reply(mockHttpRequest, 200);
      await pending;

      expect(optionsOf(mockHttpRequest).headers).toEqual({
        'X-Plex-Client-Identifier': 'Guardian',
      });
    });

    it('appends the token to a media path that already has a query', async () => {
      const pending = client.requestMedia('library/metadata/42/thumb?t=1');
      await reply(mockHttpRequest, 200);
      await pending;

      expect(optionsOf(mockHttpRequest).path).toBe(
        '/library/metadata/42/thumb?t=1&X-Plex-Token=plex%20token',
      );
    });

    it('dials https for media when SSL is on', async () => {
      settings.USE_SSL = true;

      const pending = media();
      await reply(mockHttpsRequest, 200);
      await pending;

      expect(mockHttpRequest).not.toHaveBeenCalled();
    });

    it.each([404, 500])('yields nothing on a %s', async (status) => {
      const pending = media();
      await reply(mockHttpRequest, status);

      await expect(pending).resolves.toBeNull();
    });

    it('yields nothing on a transport failure', async () => {
      const pending = media();
      await fail(errno('ECONNRESET'));

      await expect(pending).resolves.toBeNull();
    });

    it('yields nothing when the server never answers', async () => {
      const pending = media();
      await flush();
      const [delay, onTimeout] = request.setTimeout.mock.calls[0] as [
        number,
        () => void,
      ];
      onTimeout();

      expect(delay).toBe(10000);
      await expect(pending).resolves.toBeNull();
      expect(request.destroy).toHaveBeenCalled();
    });
  });

  describe('getServerIdentity', () => {
    it('reads the machine identifier', async () => {
      const pending = client.getServerIdentity();
      await reply(
        mockHttpRequest,
        200,
        '{"MediaContainer":{"machineIdentifier":"abc"}}',
      );

      await expect(pending).resolves.toBe('abc');
    });

    it('yields null when the payload has no identifier', async () => {
      const pending = client.getServerIdentity();
      await reply(mockHttpRequest, 200, '{"MediaContainer":{}}');

      await expect(pending).resolves.toBeNull();
    });

    it('yields null when the request fails', async () => {
      const pending = client.getServerIdentity();
      await fail(errno('ECONNREFUSED'));

      await expect(pending).resolves.toBeNull();
    });
  });

  describe('getSessions', () => {
    it('reads the sessions endpoint', async () => {
      const pending = client.getSessions();
      await reply(mockHttpRequest, 200, '{"MediaContainer":{"size":0}}');
      await pending;

      expect(optionsOf(mockHttpRequest).path).toContain('/status/sessions');
    });

    it('returns the parsed payload', async () => {
      const pending = client.getSessions();
      await reply(mockHttpRequest, 200, '{"MediaContainer":{"size":2}}');

      await expect(pending).resolves.toEqual({ MediaContainer: { size: 2 } });
    });

    it('propagates a failure', async () => {
      const pending = client.getSessions();
      await reply(mockHttpRequest, 500, '', 'Server Error');

      await expect(pending).rejects.toThrow('HTTP 500');
    });
  });

  describe('terminateSession', () => {
    it('asks Plex to stop the session with a reason', async () => {
      const pending = client.terminateSession('dev-1', 'Too many streams');
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      const path = optionsOf(mockHttpRequest).path ?? '';
      expect(path).toContain('/status/sessions/terminate');
      expect(path).toContain('sessionId=dev-1');
      expect(path).toContain('reason=Too+many+streams');
    });

    it('uses a default reason when none is given', async () => {
      const pending = client.terminateSession('dev-1');
      await reply(mockHttpRequest, 200, '{}');
      await pending;

      expect(optionsOf(mockHttpRequest).path).toContain(
        'reason=Session+terminated',
      );
    });

    it('does nothing without a device identifier', async () => {
      await expect(client.terminateSession('')).resolves.toBeUndefined();
      expect(mockHttpRequest).not.toHaveBeenCalled();
    });

    it('propagates a failure from Plex', async () => {
      const pending = client.terminateSession('dev-1');
      await reply(mockHttpRequest, 500, '', 'Server Error');

      await expect(pending).rejects.toThrow('HTTP 500');
    });
  });

  describe('getPlexUsers', () => {
    it('calls plex.tv over https with the token', async () => {
      const pending = client.getPlexUsers();
      await reply(mockHttpsRequest, 200, '<MediaContainer/>');
      await pending;

      const options = optionsOf(mockHttpsRequest);
      expect(options.hostname).toBe('plex.tv');
      expect(options.path).toBe('/api/users?X-Plex-Token=plex%20token');
    });

    it('parses a json body from plex.tv too', async () => {
      const pending = client.getPlexUsers();
      await reply(mockHttpsRequest, 200, '{"users":[]}');

      await expect(pending).resolves.toBe('{"users":[]}');
    });

    it('tolerates an empty body', async () => {
      const pending = client.getPlexUsers();
      await reply(mockHttpsRequest, 204);

      await expect(pending).resolves.toBe('');
    });

    it('returns the raw body so the caller can parse the XML', async () => {
      const pending = client.getPlexUsers();
      await reply(mockHttpsRequest, 200, '<MediaContainer/>');

      await expect(pending).resolves.toBe('<MediaContainer/>');
    });

    it('refuses without a token', async () => {
      settings.PLEX_TOKEN = '';

      await expect(client.getPlexUsers()).rejects.toThrow(
        'Plex token is required to fetch users',
      );
    });

    it('propagates an error status with its code attached', async () => {
      const pending = client.getPlexUsers();
      await reply(mockHttpsRequest, 401, 'denied', 'Unauthorized');

      await expect(pending).rejects.toMatchObject({ statusCode: 401 });
    });

    it('propagates a transport failure', async () => {
      const pending = client.getPlexUsers();
      await fail(errno('ENOTFOUND'));

      await expect(pending).rejects.toThrow('failed');
    });

    it('rejects when plex.tv never answers', async () => {
      const pending = client.getPlexUsers();
      await flush();
      const [, onTimeout] = request.setTimeout.mock.calls[0] as [
        number,
        () => void,
      ];
      onTimeout();

      await expect(pending).rejects.toThrow('External request timeout');
    });
  });

  describe('testConnection', () => {
    it('reports success when the server answers', async () => {
      const pending = client.testConnection();
      await reply(mockHttpRequest, 200, '{}');

      await expect(pending).resolves.toMatchObject({
        success: true,
        message: 'Connection successful',
      });
    });

    it('reports a configuration gap', async () => {
      settings.PLEX_TOKEN = '';

      await expect(client.testConnection()).resolves.toMatchObject({
        success: false,
        errorCode: PlexErrorCode.NETWORK_ERROR,
      });
    });

    it('recognises a hostname mismatch on the certificate', async () => {
      const pending = client.testConnection();
      await fail(errno('ERR_TLS_CERT_ALTNAME_INVALID'));

      await expect(pending).resolves.toMatchObject({
        errorCode: PlexErrorCode.CERT_ERROR,
      });
    });

    it('recognises any other TLS failure', async () => {
      const pending = client.testConnection();
      await fail(errno('ERR_TLS_HANDSHAKE_TIMEOUT'));

      await expect(pending).resolves.toMatchObject({
        errorCode: PlexErrorCode.SSL_ERROR,
      });
    });

    it.each(['ECONNREFUSED', 'EHOSTUNREACH'])(
      'reports %s as unreachable',
      async (code) => {
        const pending = client.testConnection();
        await fail(errno(code));

        await expect(pending).resolves.toMatchObject({
          errorCode: PlexErrorCode.CONNECTION_REFUSED,
        });
      },
    );

    it.each(['ECONNRESET', 'ETIMEDOUT'])(
      'reports %s as a timeout',
      async (code) => {
        const pending = client.testConnection();
        await fail(errno(code));

        await expect(pending).resolves.toMatchObject({
          errorCode: PlexErrorCode.CONNECTION_TIMEOUT,
        });
      },
    );

    it('reports a request timeout', async () => {
      const pending = client.testConnection();
      await flush();
      const [, onTimeout] = request.setTimeout.mock.calls[0] as [
        number,
        () => void,
      ];
      onTimeout();

      await expect(pending).resolves.toMatchObject({
        errorCode: PlexErrorCode.CONNECTION_TIMEOUT,
      });
    });

    it('blames the token on a 401', async () => {
      const pending = client.testConnection();
      await reply(mockHttpRequest, 401, '', 'Unauthorized');

      await expect(pending).resolves.toMatchObject({
        errorCode: PlexErrorCode.AUTH_FAILED,
      });
    });

    it('reports a 403 as a network error, not an auth failure', async () => {
      const pending = client.testConnection();
      await reply(mockHttpRequest, 403, '', 'Forbidden');

      await expect(pending).resolves.toMatchObject({
        errorCode: PlexErrorCode.NETWORK_ERROR,
      });
    });

    it('falls back to a generic network error', async () => {
      const pending = client.testConnection();
      await fail(errno('EPIPE', 'broken pipe'));

      await expect(pending).resolves.toMatchObject({
        errorCode: PlexErrorCode.NETWORK_ERROR,
        details: 'broken pipe',
      });
    });
  });
});
