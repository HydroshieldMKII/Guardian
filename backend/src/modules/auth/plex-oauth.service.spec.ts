import { EventEmitter } from 'events';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PlexOAuthService } from '@/modules/auth/plex-oauth.service';
import { PlexTvClient } from '@/modules/auth/plex-tv.client';

interface RequestOptions {
  path: string;
  method: string;
  headers: Record<string, string>;
}

type ResponseListener = (
  res: EventEmitter & { statusCode: number | undefined },
) => void;

const mockHttpsRequest = jest.fn<unknown, [RequestOptions, ResponseListener]>();

jest.mock('https', () => ({
  request: (options: RequestOptions, callback: ResponseListener) =>
    mockHttpsRequest(options, callback),
}));

interface PlexReply {
  statusCode?: number;
  noStatus?: boolean;
  body?: string;
  error?: Error;
  timeout?: boolean;
}

interface SentRequest {
  options: RequestOptions;
  body: string;
}

describe('PlexOAuthService', () => {
  let service: PlexOAuthService;

  let replies: PlexReply[];
  let sent: SentRequest[];

  const respondWith = (...next: PlexReply[]) => {
    replies = [...next];
  };

  const pinResponse = JSON.stringify({
    id: 42,
    code: 'ABCD',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });

  const userResponse = JSON.stringify({
    id: 9,
    uuid: 'uuid-9',
    username: 'guest',
    email: 'guest@example.com',
    thumb: 'https://plex.tv/thumb.png',
  });

  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    replies = [];
    sent = [];

    mockHttpsRequest.mockImplementation((options, callback) => {
      const record: SentRequest = { options, body: '' };
      sent.push(record);

      const errorHandlers: Array<(error: Error) => void> = [];
      let onTimeout: (() => void) | undefined;

      const req = {
        on(event: string, handler: (error: Error) => void) {
          if (event === 'error') errorHandlers.push(handler);
          return req;
        },
        setTimeout(_ms: number, handler: () => void) {
          onTimeout = handler;
          return req;
        },
        write(chunk: string) {
          record.body += chunk;
          return true;
        },
        destroy: jest.fn(),
        end() {
          process.nextTick(() => {
            const reply = replies.shift() ?? { statusCode: 200, body: '{}' };

            if (reply.timeout) {
              onTimeout?.();
              return;
            }

            if (reply.error) {
              errorHandlers.forEach((handler) => handler(reply.error!));
              return;
            }

            const res = Object.assign(new EventEmitter(), {
              statusCode: reply.noStatus
                ? undefined
                : (reply.statusCode ?? 200),
            });
            callback(res);

            process.nextTick(() => {
              if (reply.body !== undefined) res.emit('data', reply.body);
              res.emit('end');
            });
          });
          return req;
        },
      };

      return req;
    });

    const module = await Test.createTestingModule({
      providers: [PlexOAuthService, PlexTvClient],
    }).compile();

    service = module.get(PlexOAuthService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createPin = async () => {
    respondWith({ statusCode: 201, body: pinResponse });
    return service.createPlexPin('client-1');
  };

  const signIn = async () => {
    await createPin();
    respondWith(
      { statusCode: 200, body: JSON.stringify({ authToken: 'plex-token' }) },
      { statusCode: 200, body: userResponse },
    );
    await service.checkPlexPin('client-1');
  };

  describe('generateClientId', () => {
    it('namespaces the id and appends 32 hex characters', () => {
      expect(service.generateClientId()).toMatch(
        /^Guardian-Plex-Manager-[0-9a-f]{32}$/,
      );
    });

    it('produces a different id each time', () => {
      expect(service.generateClientId()).not.toBe(service.generateClientId());
    });
  });

  describe('createPlexPin', () => {
    it('returns the pin and a Plex auth url', async () => {
      const { pin, authUrl } = await createPin();

      expect(pin).toEqual({
        id: 42,
        code: 'ABCD',
        clientIdentifier: 'client-1',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      });
      expect(authUrl).toBe(
        'https://app.plex.tv/auth#?clientID=client-1&code=ABCD&context%5Bdevice%5D%5Bproduct%5D=Guardian',
      );
    });

    it('posts the Guardian product identity as form data', async () => {
      await createPin();

      expect(sent[0].options).toMatchObject({
        path: '/api/v2/pins',
        method: 'POST',
      });

      const form = new URLSearchParams(sent[0].body);
      expect(form.get('strong')).toBe('true');
      expect(form.get('X-Plex-Product')).toBe('Guardian');
      expect(form.get('X-Plex-Client-Identifier')).toBe('client-1');
    });

    it('accepts a 200 as well as a 201', async () => {
      respondWith({ statusCode: 200, body: pinResponse });
      await expect(service.createPlexPin('client-1')).resolves.toBeDefined();
    });

    it('rejects a non-2xx response', async () => {
      respondWith({ statusCode: 429, body: 'rate limited' });
      await expect(service.createPlexPin('client-1')).rejects.toThrow(
        'Failed to create Plex PIN',
      );
    });

    it('rejects a response that carries no status code', async () => {
      respondWith({ noStatus: true, body: pinResponse });
      await expect(service.createPlexPin('client-1')).rejects.toThrow(
        'Failed to create Plex PIN',
      );
    });

    it('rejects an unparseable response', async () => {
      respondWith({ statusCode: 201, body: 'not json' });
      await expect(service.createPlexPin('client-1')).rejects.toThrow(
        'Failed to parse Plex response',
      );
    });

    it('rejects a connection failure', async () => {
      respondWith({ error: new Error('ENOTFOUND') });
      await expect(service.createPlexPin('client-1')).rejects.toThrow(
        'Failed to connect to Plex',
      );
    });

    it('rejects when Plex does not answer in time', async () => {
      respondWith({ timeout: true });
      await expect(service.createPlexPin('client-1')).rejects.toThrow(
        'Plex request timeout',
      );
    });
  });

  describe('checkPlexPin', () => {
    it('refuses a client id with no pending pin', async () => {
      await expect(service.checkPlexPin('unknown')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses and forgets an expired pin', async () => {
      respondWith({
        statusCode: 201,
        body: JSON.stringify({
          id: 42,
          code: 'ABCD',
          expiresAt: '2020-01-01T00:00:00.000Z',
        }),
      });
      await service.createPlexPin('client-1');

      await expect(service.checkPlexPin('client-1')).rejects.toThrow(
        'Authentication PIN has expired',
      );
      await expect(service.checkPlexPin('client-1')).rejects.toThrow(
        'No pending authentication found',
      );
    });

    it('reports not-yet-claimed while Plex returns a null token', async () => {
      await createPin();
      respondWith({
        statusCode: 200,
        body: JSON.stringify({ authToken: null }),
      });

      await expect(service.checkPlexPin('client-1')).resolves.toBe(false);
    });

    it('reports the pin as signed in once Plex hands over a token', async () => {
      await createPin();
      respondWith(
        { statusCode: 200, body: JSON.stringify({ authToken: 'plex-token' }) },
        { statusCode: 200, body: userResponse },
      );

      await expect(service.checkPlexPin('client-1')).resolves.toBe(true);
    });

    it('keeps reporting a signed-in pin without asking Plex again', async () => {
      await signIn();

      await expect(service.checkPlexPin('client-1')).resolves.toBe(true);
      expect(sent).toHaveLength(3);
    });

    it('queries the pin by its Plex id', async () => {
      await createPin();
      respondWith({ statusCode: 200, body: JSON.stringify({}) });
      await service.checkPlexPin('client-1');

      expect(sent[1].options.path).toBe('/api/v2/pins/42');
      expect(sent[1].options.headers['X-Plex-Client-Identifier']).toBe(
        'client-1',
      );
    });

    it('treats a non-200 as not-yet-claimed', async () => {
      await createPin();
      respondWith({ statusCode: 500, body: '' });
      await expect(service.checkPlexPin('client-1')).resolves.toBe(false);
    });

    it('treats an unparseable response as not-yet-claimed', async () => {
      await createPin();
      respondWith({ statusCode: 200, body: 'not json' });
      await expect(service.checkPlexPin('client-1')).resolves.toBe(false);
    });

    it('treats a connection failure as not-yet-claimed', async () => {
      await createPin();
      respondWith({ error: new Error('ECONNRESET') });
      await expect(service.checkPlexPin('client-1')).resolves.toBe(false);
    });

    it('treats a timeout as not-yet-claimed', async () => {
      await createPin();
      respondWith({ timeout: true });
      await expect(service.checkPlexPin('client-1')).resolves.toBe(false);
    });

    it('propagates a failure to load the claimed user', async () => {
      await createPin();
      respondWith(
        { statusCode: 200, body: JSON.stringify({ authToken: 'plex-token' }) },
        { statusCode: 401, body: '' },
      );

      await expect(service.checkPlexPin('client-1')).rejects.toThrow(
        'Failed to get Plex user info',
      );
    });
  });

  describe('claimPlexUser', () => {
    it('hands over the signed-in Plex user', async () => {
      await signIn();

      expect(service.claimPlexUser('client-1')).toEqual({
        id: 9,
        uuid: 'uuid-9',
        username: 'guest',
        email: 'guest@example.com',
        thumb: 'https://plex.tv/thumb.png',
        authToken: 'plex-token',
      });
    });

    it('looks the user up with the token Plex handed over', async () => {
      await signIn();

      expect(sent[2].options.path).toBe('/api/v2/user');
      expect(sent[2].options.headers['X-Plex-Token']).toBe('plex-token');
    });

    it('hands the user over only once', async () => {
      await signIn();
      service.claimPlexUser('client-1');

      expect(() => service.claimPlexUser('client-1')).toThrow(
        'Sign in with Plex first',
      );
    });

    it('refuses a pin that is not signed in yet', async () => {
      await createPin();

      expect(() => service.claimPlexUser('client-1')).toThrow(
        'Sign in with Plex first',
      );
    });

    it('refuses a client id it never issued', () => {
      expect(() => service.claimPlexUser('unknown')).toThrow(
        'Sign in with Plex first',
      );
    });
  });

  describe('loading the signed-in Plex user', () => {
    const signInWithUserResponse = async (response: PlexReply) => {
      await createPin();
      respondWith(
        { statusCode: 200, body: JSON.stringify({ authToken: 'plex-token' }) },
        response,
      );
      return service.checkPlexPin('client-1');
    };

    it('rejects an unparseable response', async () => {
      await expect(
        signInWithUserResponse({ statusCode: 200, body: 'not json' }),
      ).rejects.toThrow('Failed to parse Plex user info');
    });

    it('rejects a connection failure', async () => {
      await expect(
        signInWithUserResponse({ error: new Error('ENOTFOUND') }),
      ).rejects.toThrow('Failed to connect to Plex');
    });

    it('rejects a timeout', async () => {
      await expect(signInWithUserResponse({ timeout: true })).rejects.toThrow(
        'Plex request timeout',
      );
    });
  });

  describe('cancelPlexPin', () => {
    it('forgets a pin the user abandoned', async () => {
      await createPin();

      service.cancelPlexPin('client-1');

      await expect(service.checkPlexPin('client-1')).rejects.toThrow(
        'No pending authentication found',
      );
    });

    it('ignores a client id it never issued', () => {
      expect(() => service.cancelPlexPin('unknown')).not.toThrow();
    });
  });

  describe('pending pin housekeeping', () => {
    it('forgets a pin that has aged past ten minutes', async () => {
      await createPin();

      jest.advanceTimersByTime(16 * 60 * 1000);

      await expect(service.checkPlexPin('client-1')).rejects.toThrow(
        'No pending authentication found',
      );
    });

    it('keeps a fresh, unexpired pin', async () => {
      await createPin();

      jest.advanceTimersByTime(5 * 60 * 1000);
      respondWith({ statusCode: 200, body: JSON.stringify({}) });

      await expect(service.checkPlexPin('client-1')).resolves.toBe(false);
    });
  });
});
