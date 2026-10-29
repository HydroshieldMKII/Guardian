import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SessionsController } from '@/modules/sessions/sessions.controller';
import { ActiveSessionService } from '@/modules/sessions/services/active-session.service';
import { SessionHistoryService } from '@/modules/sessions/services/session-history.service';
import type { Mock } from 'vitest';

describe('SessionsController', () => {
  let controller: SessionsController;
  let activeSessionService: Record<string, Mock>;
  let sessionHistoryService: Record<string, Mock>;

  beforeEach(async () => {
    activeSessionService = {
      getActiveSessionsFormatted: vi
        .fn()
        .mockResolvedValue({ MediaContainer: { size: 0 } }),
    };
    sessionHistoryService = {
      getUserSessionHistory: vi.fn().mockResolvedValue([{ id: 1 }]),
      deleteSessionHistory: vi.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: ActiveSessionService, useValue: activeSessionService },
        { provide: SessionHistoryService, useValue: sessionHistoryService },
      ],
    }).compile();

    controller = module.get(SessionsController);
  });

  it('returns the formatted active sessions', async () => {
    await expect(controller.getActiveSessions()).resolves.toEqual({
      MediaContainer: { size: 0 },
    });
  });

  it('defaults the history page to the first 50 completed sessions', async () => {
    await controller.getUserSessionHistory('u1');
    expect(sessionHistoryService.getUserSessionHistory).toHaveBeenCalledWith(
      'u1',
      {
        limit: 50,
        offset: 0,
        includeActive: false,
        search: undefined,
        terminatedOnly: false,
        app: undefined,
      },
    );
  });

  it('parses the paging, filter and search parameters', async () => {
    await controller.getUserSessionHistory(
      'u1',
      '10',
      'true',
      '20',
      'ennemie',
      'true',
      'plexamp',
    );
    expect(sessionHistoryService.getUserSessionHistory).toHaveBeenCalledWith(
      'u1',
      {
        limit: 10,
        offset: 20,
        includeActive: true,
        search: 'ennemie',
        terminatedOnly: true,
        app: 'plexamp',
      },
    );
  });

  it.each(['plex', 'plexamp'] as const)(
    'passes the %s app filter through',
    async (app) => {
      await controller.getUserSessionHistory(
        'u1',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        app,
      );
      expect(sessionHistoryService.getUserSessionHistory).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ app }),
      );
    },
  );

  it('ignores an unknown app filter', async () => {
    await controller.getUserSessionHistory(
      'u1',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'kodi',
    );
    expect(sessionHistoryService.getUserSessionHistory).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ app: undefined }),
    );
  });

  it('treats any other flag value as false', async () => {
    await controller.getUserSessionHistory(
      'u1',
      '10',
      'yes',
      undefined,
      undefined,
      'yes',
    );
    expect(sessionHistoryService.getUserSessionHistory).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        includeActive: false,
        terminatedOnly: false,
        offset: 0,
      }),
    );
  });

  it('deletes a history row by numeric id', async () => {
    await expect(controller.deleteSessionHistory(42)).resolves.toEqual({
      success: true,
    });
    expect(sessionHistoryService.deleteSessionHistory).toHaveBeenCalledWith(42);
  });

  it.each([0, -1])('rejects the non-positive id %i with a 400', async (id) => {
    await expect(controller.deleteSessionHistory(id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(sessionHistoryService.deleteSessionHistory).not.toHaveBeenCalled();
  });

  it.each([
    ['abc', undefined, 50, 0],
    ['-5', '-1', 50, 0],
    ['0', '1.5', 50, 0],
    ['99999999999', '30', 200, 30],
    ['1e30', '1e3', 50, 0],
  ])(
    'parses limit=%s offset=%s as %i/%i',
    async (limit, offset, expectedLimit, expectedOffset) => {
      await controller.getUserSessionHistory('u1', limit, undefined, offset);
      expect(sessionHistoryService.getUserSessionHistory).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          limit: expectedLimit,
          offset: expectedOffset,
        }),
      );
    },
  );
});
