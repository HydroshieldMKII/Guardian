import { Test } from '@nestjs/testing';
import { DevicesService } from '@/modules/devices/services/devices.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { ConnectionTestService } from '@/modules/config/services/connection-test.service';
import { UsersService } from '@/modules/users/services/users.service';
import { PlexService } from '@/modules/plex/services/plex.service';
import { DashboardService } from '@/modules/dashboard/dashboard.service';

const configuredStatus = {
  configured: true,
  hasValidCredentials: true,
  connectionStatus: 'connected',
};

describe('DashboardService', () => {
  let service: DashboardService;
  let configService: { getPublicSettings: jest.Mock };
  let connectionTest: { getPlexConfigurationStatus: jest.Mock };
  let plexService: { getActiveSessionsWithMediaUrls: jest.Mock };
  let devicesService: {
    getAllDevices: jest.Mock;
    getPendingDevices: jest.Mock;
    getApprovedDevices: jest.Mock;
    getProcessedDevices: jest.Mock;
  };
  let usersService: { getAllUsers: jest.Mock };

  beforeEach(async () => {
    configService = {
      getPublicSettings: jest.fn().mockResolvedValue([{ key: 'TIMEZONE' }]),
    };
    connectionTest = {
      getPlexConfigurationStatus: jest.fn().mockResolvedValue(configuredStatus),
    };

    plexService = {
      getActiveSessionsWithMediaUrls: jest
        .fn()
        .mockResolvedValue({ MediaContainer: { size: 2, Metadata: [{}, {}] } }),
    };

    devicesService = {
      getAllDevices: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      getPendingDevices: jest.fn().mockResolvedValue([{ id: 2 }]),
      getApprovedDevices: jest.fn().mockResolvedValue([{ id: 1 }]),
      getProcessedDevices: jest.fn().mockResolvedValue([{ id: 1 }]),
    };

    usersService = { getAllUsers: jest.fn().mockResolvedValue([{ id: 'u1' }]) };

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: ConfigService, useValue: configService },
        { provide: ConnectionTestService, useValue: connectionTest },
        { provide: PlexService, useValue: plexService },
        { provide: DevicesService, useValue: devicesService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  describe('when Plex is configured', () => {
    it('returns the aggregated payload', async () => {
      const result = await service.getDashboardData();

      expect(result.plexStatus).toEqual(configuredStatus);
      expect(result.settings).toHaveLength(1);
      expect(result.users).toHaveLength(1);
      expect(result.devices.all).toHaveLength(2);
    });

    it('derives the stats from the fetched data', async () => {
      const result = await service.getDashboardData();

      expect(result.stats).toEqual({
        activeStreams: 2,
        totalDevices: 2,
        pendingDevices: 1,
        approvedDevices: 1,
      });
    });

    it('requests hidden users as well', async () => {
      await service.getDashboardData();
      expect(usersService.getAllUsers).toHaveBeenCalledWith(true);
    });

    it('excludes Plexamp devices from the pending count by product', async () => {
      devicesService.getPendingDevices.mockResolvedValue([
        { id: 2, deviceProduct: 'Plexamp' },
        { id: 3, deviceProduct: 'Plex Web' },
      ]);

      const result = await service.getDashboardData();
      expect(result.stats.pendingDevices).toBe(1);
    });

    it('excludes Plexamp devices from the pending count', async () => {
      devicesService.getPendingDevices.mockResolvedValue([
        { id: 2, deviceProduct: 'Plexamp' },
      ]);

      const result = await service.getDashboardData();
      expect(result.stats.pendingDevices).toBe(0);
    });

    it('still counts a device that is only named like Plexamp', async () => {
      devicesService.getPendingDevices.mockResolvedValue([
        { id: 2, deviceProduct: 'Plex Web', deviceName: 'Kitchen PlexAmp' },
      ]);

      const result = await service.getDashboardData();
      expect(result.stats.pendingDevices).toBe(1);
    });

    it('still lists Plexamp devices under pending devices', async () => {
      devicesService.getPendingDevices.mockResolvedValue([
        { id: 2, deviceProduct: 'Plexamp' },
      ]);

      const result = await service.getDashboardData();
      expect(result.devices.pending).toHaveLength(1);
    });

    it('treats a missing session container as zero streams', async () => {
      plexService.getActiveSessionsWithMediaUrls.mockResolvedValue({});
      const result = await service.getDashboardData();
      expect(result.stats.activeStreams).toBe(0);
    });
  });

  describe('when Plex is not usable', () => {
    it('returns an empty payload when unconfigured', async () => {
      connectionTest.getPlexConfigurationStatus.mockResolvedValue({
        ...configuredStatus,
        configured: false,
      });

      const result = await service.getDashboardData();

      expect(result.devices).toEqual({
        all: [],
        pending: [],
        approved: [],
        processed: [],
      });
      expect(result.stats.activeStreams).toBe(0);
      expect(plexService.getActiveSessionsWithMediaUrls).not.toHaveBeenCalled();
    });

    it('returns an empty payload when credentials are invalid', async () => {
      connectionTest.getPlexConfigurationStatus.mockResolvedValue({
        ...configuredStatus,
        hasValidCredentials: false,
      });

      const result = await service.getDashboardData();
      expect(result.users).toEqual([]);
    });

    it('still returns settings so the UI can render', async () => {
      connectionTest.getPlexConfigurationStatus.mockResolvedValue({
        ...configuredStatus,
        configured: false,
      });

      const result = await service.getDashboardData();
      expect(result.settings).toHaveLength(1);
    });
  });

  describe('failures', () => {
    it('propagates an error from a downstream service', async () => {
      devicesService.getAllDevices.mockRejectedValue(new Error('db down'));
      await expect(service.getDashboardData()).rejects.toThrow('db down');
    });

    it('propagates an error from the config lookup', async () => {
      connectionTest.getPlexConfigurationStatus.mockRejectedValue(
        new Error('no config'),
      );
      await expect(service.getDashboardData()).rejects.toThrow('no config');
    });

    it('logs a failure that carries no stack', async () => {
      const bare = { message: 'no stack here' };
      devicesService.getAllDevices.mockRejectedValue(bare);

      await expect(service.getDashboardData()).rejects.toBe(bare);
    });
  });
});
