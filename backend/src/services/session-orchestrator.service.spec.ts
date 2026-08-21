import { Test } from '@nestjs/testing';
import { PlexSessionsResponse } from '../types/plex.types';
import { ActiveSessionService } from '../modules/sessions/services/active-session.service';
import { DeviceTrackingService } from '../modules/devices/services/device-tracking.service';
import { SessionTerminationService } from '../modules/plex/services/session-termination.service';
import { SessionOrchestratorService } from './session-orchestrator.service';

describe('SessionOrchestratorService', () => {
  let service: SessionOrchestratorService;
  let activeSessionService: { updateActiveSessions: jest.Mock };
  let deviceTrackingService: { processSessionsForDeviceTracking: jest.Mock };
  let sessionTerminationService: { stopUnapprovedSessions: jest.Mock };
  let order: string[];

  const sessionsData = {
    MediaContainer: { size: 1, Metadata: [{ sessionKey: 'sk-1' }] },
  } as PlexSessionsResponse;

  beforeEach(async () => {
    order = [];

    deviceTrackingService = {
      processSessionsForDeviceTracking: jest.fn(async () => {
        order.push('track');
      }),
    };
    activeSessionService = {
      updateActiveSessions: jest.fn(async () => {
        order.push('history');
      }),
    };
    sessionTerminationService = {
      stopUnapprovedSessions: jest.fn(async () => {
        order.push('enforce');
        return { stoppedSessions: [], errors: [] };
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        SessionOrchestratorService,
        { provide: ActiveSessionService, useValue: activeSessionService },
        { provide: DeviceTrackingService, useValue: deviceTrackingService },
        {
          provide: SessionTerminationService,
          useValue: sessionTerminationService,
        },
      ],
    }).compile();

    service = module.get(SessionOrchestratorService);
  });

  it('tracks devices before writing history and enforcing policies', async () => {
    await service.orchestrateSessionUpdate(sessionsData);
    expect(order).toEqual(['track', 'history', 'enforce']);
  });

  it('returns the payload it was given', async () => {
    await expect(service.orchestrateSessionUpdate(sessionsData)).resolves.toBe(
      sessionsData,
    );
  });

  it('passes the same payload to every step', async () => {
    await service.orchestrateSessionUpdate(sessionsData);

    expect(
      deviceTrackingService.processSessionsForDeviceTracking,
    ).toHaveBeenCalledWith(sessionsData);
    expect(activeSessionService.updateActiveSessions).toHaveBeenCalledWith(
      sessionsData,
    );
    expect(
      sessionTerminationService.stopUnapprovedSessions,
    ).toHaveBeenCalledWith(sessionsData);
  });

  it.each([
    ['device tracking', 'deviceTracking'],
    ['session history', 'activeSession'],
    ['policy enforcement', 'termination'],
  ] as const)('carries on when %s fails', async (_label, failing) => {
    const targets = {
      deviceTracking: deviceTrackingService.processSessionsForDeviceTracking,
      activeSession: activeSessionService.updateActiveSessions,
      termination: sessionTerminationService.stopUnapprovedSessions,
    };
    targets[failing].mockRejectedValue(new Error('step failed'));

    await expect(service.orchestrateSessionUpdate(sessionsData)).resolves.toBe(
      sessionsData,
    );
  });

  it('still enforces policies when device tracking failed', async () => {
    deviceTrackingService.processSessionsForDeviceTracking.mockRejectedValue(
      new Error('db down'),
    );

    await service.orchestrateSessionUpdate(sessionsData);
    expect(order).toEqual(['history', 'enforce']);
  });
});
