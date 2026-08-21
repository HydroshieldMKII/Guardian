import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { ConfigService } from '../../config/services/config.service';
import { PUBLIC_KEY } from '../decorators/public.decorator';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { AuthGuard } from './auth.guard';

const adminUser = { userType: 'admin', sessionId: 's1', username: 'admin' };
const plexUser = {
  userType: 'plex_user',
  sessionId: 's2',
  plexUserId: '7',
  plexUsername: 'alice',
};

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: { validateSession: jest.Mock };
  let configService: { getSetting: jest.Mock };
  let reflector: { get: jest.Mock };
  let request: Partial<Request>;

  const context = () =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    }) as ExecutionContext;

  const setMetadata = (key: string, value: boolean) => {
    reflector.get.mockImplementation((metadataKey: string) =>
      metadataKey === key ? value : undefined,
    );
  };

  beforeEach(() => {
    request = { method: 'GET', cookies: { session_token: 'token-1' } };
    authService = { validateSession: jest.fn().mockResolvedValue(adminUser) };
    configService = { getSetting: jest.fn().mockResolvedValue(true) };
    reflector = { get: jest.fn().mockReturnValue(undefined) };

    guard = new AuthGuard(
      authService as unknown as AuthService,
      configService as unknown as ConfigService,
      reflector as unknown as Reflector,
    );
  });

  it('lets a CORS preflight through untouched', async () => {
    request.method = 'OPTIONS';
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(authService.validateSession).not.toHaveBeenCalled();
  });

  it('lets a public route through without a token', async () => {
    setMetadata(PUBLIC_KEY, true);
    request.cookies = {};

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(authService.validateSession).not.toHaveBeenCalled();
  });

  it('rejects a request with no session cookie', async () => {
    request.cookies = {};
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a request with no cookies at all', async () => {
    request.cookies = undefined;
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an invalid session', async () => {
    authService.validateSession.mockResolvedValue(null);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('admits an admin and attaches the user', async () => {
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(request.user).toBe(adminUser);
  });

  it('reads the token from the session cookie', async () => {
    await guard.canActivate(context());
    expect(authService.validateSession).toHaveBeenCalledWith('token-1');
  });

  it('admits a Plex user while the portal is enabled', async () => {
    authService.validateSession.mockResolvedValue(plexUser);
    configService.getSetting.mockResolvedValue(true);

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('rejects a Plex user while the portal is disabled', async () => {
    authService.validateSession.mockResolvedValue(plexUser);
    configService.getSetting.mockResolvedValue(false);

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('treats a non-boolean portal setting as disabled', async () => {
    authService.validateSession.mockResolvedValue(plexUser);
    configService.getSetting.mockResolvedValue('true');

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does not consult the portal setting for an admin', async () => {
    await guard.canActivate(context());
    expect(configService.getSetting).not.toHaveBeenCalled();
  });

  it('rejects a Plex user on an admin-only route', async () => {
    authService.validateSession.mockResolvedValue(plexUser);
    reflector.get.mockImplementation((key: string) =>
      key === ADMIN_ONLY_KEY ? true : undefined,
    );

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('admits an admin on an admin-only route', async () => {
    setMetadata(ADMIN_ONLY_KEY, true);
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });
});
