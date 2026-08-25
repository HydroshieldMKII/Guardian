import { Test } from '@nestjs/testing';
import { DashboardController } from '@/modules/dashboard/dashboard.controller';
import { DashboardService } from '@/modules/dashboard/dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: { getDashboardData: jest.Mock };

  beforeEach(async () => {
    dashboardService = {
      getDashboardData: jest.fn().mockResolvedValue({ stats: {} }),
    };

    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: dashboardService }],
    }).compile();

    controller = module.get(DashboardController);
  });

  it('returns the aggregated dashboard payload', async () => {
    await expect(controller.getDashboardData()).resolves.toEqual({ stats: {} });
  });

  it('propagates a failure from the service', async () => {
    dashboardService.getDashboardData.mockRejectedValue(new Error('db down'));
    await expect(controller.getDashboardData()).rejects.toThrow('db down');
  });
});
