import { EventEmitter } from 'events';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminUser } from '@/entities/admin-user.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { PlexOAuthService } from '@/modules/auth/plex-oauth.service';

interface RequestOptions {
  path: string;
  method: string;
  headers: Record<string, string>;
}

type ResponseListener = (res: EventEmitter & { statusCode: number }) => void;

const mockHttpsRequest = jest.fn<unknown, [RequestOptions, ResponseListener]>();

jest.mock('https', () => ({
  request: (options: RequestOptions, callback: ResponseListener) =>
    mockHttpsRequest(options, callback),
}));

interface PlexReply {
  statusCode?: number;
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
  let adminRepo: Record<string, jest.Mock>;
  let preferenceRepo: { findOne: jest.Mock };
  let selectQueryBuilder: Record<string, jest.Mock>;
  let updateQueryBuilder: Record<string, jest.Mock>;

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
              statusCode: reply.statusCode ?? 200,
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

    selectQueryBuilder = {
      where: jest.fn(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    selectQueryBuilder.where.mockReturnValue(selectQueryBuilder);

    updateQueryBuilder = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    updateQueryBuilder.update.mockReturnValue(updateQueryBuilder);
    updateQueryBuilder.set.mockReturnValue(updateQueryBuilder);
    updateQueryBuilder.where.mockReturnValue(updateQueryBuilder);

    adminRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'admin-1' }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn((alias?: string) =>
        alias ? selectQueryBuilder : updateQueryBuilder,
      ),
    };

    preferenceRepo = { findOne: jest.fn().mockResolvedValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        PlexOAuthService,
        { provide: getRepositoryToken(AdminUser), useValue: adminRepo },
        {
          provide: getRepositoryToken(UserPreference),
          useValue: preferenceRepo,
        },
      ],
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

  describe('generateClientId', () => {
    it('namespaces the id and appends 16 hex characters', () => {
      expect(service.generateClientId()).toMatch(
        /^Guardian-Plex-Manager-[0-9a-f]{16}$/,
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

      await expect(service.checkPlexPin('client-1')).resolves.toBeNull();
    });

    it('resolves the Plex user once the pin is claimed', async () => {
      await createPin();
      respondWith(
        { statusCode: 200, body: JSON.stringify({ authToken: 'plex-token' }) },
        { statusCode: 200, body: userResponse },
      );

      await expect(service.checkPlexPin('client-1')).resolves.toEqual({
        id: 9,
        uuid: 'uuid-9',
        username: 'guest',
        email: 'guest@example.com',
        thumb: 'https://plex.tv/thumb.png',
        authToken: 'plex-token',
      });
    });

    it('forgets the pin once it has been redeemed', async () => {
      await createPin();
      respondWith(
        { statusCode: 200, body: JSON.stringify({ authToken: 'plex-token' }) },
        { statusCode: 200, body: userResponse },
      );
      await service.checkPlexPin('client-1');

      await expect(service.checkPlexPin('client-1')).rejects.toThrow(
        'No pending authentication found',
      );
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
      await expect(service.checkPlexPin('client-1')).resolves.toBeNull();
    });

    it('treats an unparseable response as not-yet-claimed', async () => {
      await createPin();
      respondWith({ statusCode: 200, body: 'not json' });
      await expect(service.checkPlexPin('client-1')).resolves.toBeNull();
    });

    it('treats a connection failure as not-yet-claimed', async () => {
      await createPin();
      respondWith({ error: new Error('ECONNRESET') });
      await expect(service.checkPlexPin('client-1')).resolves.toBeNull();
    });

    it('treats a timeout as not-yet-claimed', async () => {
      await createPin();
      respondWith({ timeout: true });
      await expect(service.checkPlexPin('client-1')).resolves.toBeNull();
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

  describe('getPlexUserFromToken', () => {
    it('sends the token as an X-Plex-Token header', async () => {
      respondWith({ statusCode: 200, body: userResponse });
      await service.getPlexUserFromToken('plex-token');

      expect(sent[0].options.path).toBe('/api/v2/user');
      expect(sent[0].options.headers['X-Plex-Token']).toBe('plex-token');
    });

    it('returns the user carrying the token back', async () => {
      respondWith({ statusCode: 200, body: userResponse });
      await expect(
        service.getPlexUserFromToken('plex-token'),
      ).resolves.toMatchObject({ username: 'guest', authToken: 'plex-token' });
    });

    it('rejects an unauthorised token', async () => {
      respondWith({ statusCode: 401, body: '' });
      await expect(service.getPlexUserFromToken('bad')).rejects.toThrow(
        'Failed to get Plex user info',
      );
    });

    it('rejects an unparseable response', async () => {
      respondWith({ statusCode: 200, body: 'not json' });
      await expect(service.getPlexUserFromToken('tok')).rejects.toThrow(
        'Failed to parse Plex user info',
      );
    });

    it('rejects a connection failure', async () => {
      respondWith({ error: new Error('ENOTFOUND') });
      await expect(service.getPlexUserFromToken('tok')).rejects.toThrow(
        'Failed to connect to Plex',
      );
    });

    it('rejects a timeout', async () => {
      respondWith({ timeout: true });
      await expect(service.getPlexUserFromToken('tok')).rejects.toThrow(
        'Plex request timeout',
      );
    });
  });

  describe('server access checks', () => {
    it('treats a synced user preference as proof of access', async () => {
      preferenceRepo.findOne.mockResolvedValue({ userId: '9' });
      await expect(service.isPlexUserOnServer('9', '')).resolves.toBe(true);
    });

    it('denies a Plex user with no preference row', async () => {
      await expect(service.isPlexUserOnServer('9', '')).resolves.toBe(false);
    });

    it('exposes the preference row by Plex id', async () => {
      await service.getUserPreferenceByPlexId('9');
      expect(preferenceRepo.findOne).toHaveBeenCalledWith({
        where: { userId: '9' },
      });
    });
  });

  describe('admin Plex links', () => {
    it('finds any admin with a linked Plex account', async () => {
      selectQueryBuilder.getOne.mockResolvedValue({ id: 'admin-1' });
      await expect(service.getAdminWithPlexLinked()).resolves.toEqual({
        id: 'admin-1',
      });
      expect(selectQueryBuilder.where).toHaveBeenCalledWith(
        'admin.plexUserId IS NOT NULL',
      );
    });

    it('reports Plex OAuth as enabled when a link exists', async () => {
      selectQueryBuilder.getOne.mockResolvedValue({ id: 'admin-1' });
      await expect(service.hasPlexOAuthEnabled()).resolves.toBe(true);
    });

    it('reports Plex OAuth as disabled when no link exists', async () => {
      await expect(service.hasPlexOAuthEnabled()).resolves.toBe(false);
    });
  });

  describe('linkPlexAccountToAdmin', () => {
    const plexUser = {
      id: 9,
      uuid: 'uuid-9',
      username: 'guest',
      email: 'guest@example.com',
      thumb: 'thumb.png',
      authToken: 'tok',
    };

    it('stores the Plex identity against the admin', async () => {
      await service.linkPlexAccountToAdmin('admin-1', plexUser);

      expect(adminRepo.update).toHaveBeenCalledWith('admin-1', {
        plexUserId: '9',
        plexUsername: 'guest',
        plexEmail: 'guest@example.com',
        plexThumb: 'thumb.png',
      });
    });

    it('refuses a Plex account already linked elsewhere', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-2' });

      await expect(
        service.linkPlexAccountToAdmin('admin-1', plexUser),
      ).rejects.toThrow('This Plex account is already linked to another admin');
      expect(adminRepo.update).not.toHaveBeenCalled();
    });

    it('allows re-linking the same account to the same admin', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1' });
      await expect(
        service.linkPlexAccountToAdmin('admin-1', plexUser),
      ).resolves.toEqual({ id: 'admin-1' });
    });
  });

  describe('unlinkPlexAccountFromAdmin', () => {
    it('nulls every Plex column for that admin', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1' });
      await service.unlinkPlexAccountFromAdmin('admin-1');

      expect(updateQueryBuilder.set).toHaveBeenCalledWith({
        plexUserId: null,
        plexUsername: null,
        plexEmail: null,
        plexThumb: null,
      });
      expect(updateQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: 'admin-1',
      });
    });

    it('returns the refreshed admin row', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 'admin-1' });
      await expect(
        service.unlinkPlexAccountFromAdmin('admin-1'),
      ).resolves.toEqual({ id: 'admin-1' });
    });

    it('refuses an unknown admin', async () => {
      await expect(service.unlinkPlexAccountFromAdmin('ghost')).rejects.toThrow(
        'Admin not found',
      );
      expect(updateQueryBuilder.execute).not.toHaveBeenCalled();
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

      await expect(service.checkPlexPin('client-1')).resolves.toBeNull();
    });
  });
});
