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

  it('defaults the history limit to 50 and excludes active sessions', async () => {
    await controller.getUserSessionHistory('u1');
    expect(activeSessionService.getUserSessionHistory).toHaveBeenCalledWith(
      'u1',
      50,
      false,
    );
  });

  it('parses the limit and the include-active flag', async () => {
    await controller.getUserSessionHistory('u1', '10', 'true');
    expect(activeSessionService.getUserSessionHistory).toHaveBeenCalledWith(
      'u1',
      10,
      true,
    );
  });

  it('treats any other include-active value as false', async () => {
    await controller.getUserSessionHistory('u1', '10', 'yes');
    expect(activeSessionService.getUserSessionHistory).toHaveBeenCalledWith(
      'u1',
      10,
      false,
    );
  });

  it('deletes a history row by numeric id', async () => {
    await expect(controller.deleteSessionHistory('42')).resolves.toEqual({
      success: true,
    });
    expect(activeSessionService.deleteSessionHistory).toHaveBeenCalledWith(42);
  });
});
