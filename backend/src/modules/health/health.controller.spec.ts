import { Test } from '@nestjs/testing';
import { HealthController } from '@/modules/health/health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports an ok status', () => {
    expect(controller.check().status).toBe('ok');
  });

  it('identifies the service', () => {
    expect(controller.check().service).toBe('guardian-backend');
  });

  it('returns ISO timestamps', () => {
    const result = controller.check();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    expect(new Date(result.uptime.startTime).toISOString()).toBe(
      result.uptime.startTime,
    );
  });

  it('reports a non-negative uptime', () => {
    const result = controller.check();
    expect(result.uptime.milliseconds).toBeGreaterThanOrEqual(0);
    expect(result.uptime.seconds).toBeGreaterThanOrEqual(0);
  });

  it('derives seconds from milliseconds', () => {
    const result = controller.check();
    expect(result.uptime.seconds).toBe(
      Math.floor(result.uptime.milliseconds / 1000),
    );
  });

  it('keeps the start time fixed while uptime grows', async () => {
    const first = controller.check();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = controller.check();

    expect(second.uptime.startTime).toBe(first.uptime.startTime);
    expect(second.uptime.milliseconds).toBeGreaterThanOrEqual(
      first.uptime.milliseconds,
    );
  });
});
