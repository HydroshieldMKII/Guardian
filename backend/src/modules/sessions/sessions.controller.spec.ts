import { Test } from '@nestjs/testing';
import { SessionsController } from '@/modules/sessions/sessions.controller';
import { ActiveSessionService } from '@/modules/sessions/services/active-session.service';

describe('SessionsController', () => {
  let controller: SessionsController;
  let activeSessionService: Record<string, jest.Mock>;

  beforeEach(async () => {
    activeSessionService = {
      getActiveSessionsFormatted: jest
        .fn()
        .mockResolvedValue({ MediaContainer: { size: 0 } }),
      getUserSessionHistory: jest.fn().mockResolvedValue([{ id: 1 }]),
      deleteSessionHistory: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: ActiveSessionService, useValue: activeSessionService },
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
    expect(activeSessionService.getUserSessionHistory).toHaveBeenCalledWith(
      'u1',
      {
        limit: 50,
        offset: 0,
        includeActive: false,
        search: undefined,
        terminatedOnly: false,
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
    );
    expect(activeSessionService.getUserSessionHistory).toHaveBeenCalledWith(
      'u1',
      {
        limit: 10,
        offset: 20,
        includeActive: true,
        search: 'ennemie',
        terminatedOnly: true,
      },
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
    expect(activeSessionService.getUserSessionHistory).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        includeActive: false,
        terminatedOnly: false,
        offset: 0,
      }),
    );
  });

  it('deletes a history row by numeric id', async () => {
    await expect(controller.deleteSessionHistory('42')).resolves.toEqual({
      success: true,
    });
    expect(activeSessionService.deleteSessionHistory).toHaveBeenCalledWith(42);
  });
});
