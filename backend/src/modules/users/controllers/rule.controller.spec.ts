import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RuleController } from './rule.controller';
import { TimeRuleService } from '../services/time-rule.service';

describe('RuleController', () => {
  let controller: RuleController;
  let timeRuleService: Record<string, jest.Mock>;

  const rule = { id: 1, userId: 'u1', enabled: true };

  beforeEach(async () => {
    timeRuleService = {
      getAllTimeRules: jest.fn().mockResolvedValue([rule]),
      getTimeRules: jest.fn().mockResolvedValue([rule]),
      createTimeRule: jest.fn().mockResolvedValue(rule),
      updateTimeRule: jest.fn().mockResolvedValue(rule),
      toggleTimeRule: jest.fn().mockResolvedValue({ ...rule, enabled: false }),
      deleteTimeRule: jest.fn().mockResolvedValue(undefined),
      checkStreamingAllowed: jest
        .fn()
        .mockResolvedValue({ allowed: true, reason: 'no rules' }),
      createPreset: jest.fn().mockResolvedValue([rule]),
    };

    const module = await Test.createTestingModule({
      controllers: [RuleController],
      providers: [{ provide: TimeRuleService, useValue: timeRuleService }],
    }).compile();

    controller = module.get(RuleController);
  });

  describe('getTimeRulesBatch', () => {
    it('keys the rules by user id', async () => {
      await expect(
        controller.getTimeRulesBatch({ userIds: ['u1', 'u2'] }),
      ).resolves.toEqual({ u1: [rule], u2: [rule] });
    });

    it('returns an empty list for a user whose lookup fails', async () => {
      timeRuleService.getAllTimeRules
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValueOnce([rule]);

      const result = await controller.getTimeRulesBatch({
        userIds: ['u1', 'u2'],
      });

      expect(result.u1).toEqual([]);
      expect(result.u2).toEqual([rule]);
    });

    it('handles a rejection carrying no stack', async () => {
      timeRuleService.getAllTimeRules.mockRejectedValue('plain string');
      await expect(
        controller.getTimeRulesBatch({ userIds: ['u1'] }),
      ).resolves.toEqual({ u1: [] });
    });

    it('returns an empty map for an empty request', async () => {
      await expect(
        controller.getTimeRulesBatch({ userIds: [] }),
      ).resolves.toEqual({});
    });
  });

  it('injects the path user id when creating a rule', async () => {
    const dto = {
      ruleName: 'Bedtime',
      dayOfWeek: 1,
      startTime: '20:00',
      endTime: '22:00',
    };

    await controller.createTimeRule('u1', dto);
    expect(timeRuleService.createTimeRule).toHaveBeenCalledWith({
      ...dto,
      userId: 'u1',
    });
  });

  it('passes the optional device filter through', async () => {
    await controller.getTimeRules('u1', 'dev-1');
    expect(timeRuleService.getTimeRules).toHaveBeenCalledWith('u1', 'dev-1');
  });

  it('omits the device filter when absent', async () => {
    await controller.getTimeRules('u1');
    expect(timeRuleService.getTimeRules).toHaveBeenCalledWith('u1', undefined);
  });

  it('lists every rule for a user', async () => {
    await expect(controller.getAllTimeRules('u1')).resolves.toEqual([rule]);
  });

  it('lists rules scoped to a device', async () => {
    await controller.getTimeRulesForDevice('u1', 'dev-1');
    expect(timeRuleService.getTimeRules).toHaveBeenCalledWith('u1', 'dev-1');
  });

  it('updates a rule', async () => {
    await controller.updateTimeRule('u1', 4, { enabled: false });
    expect(timeRuleService.updateTimeRule).toHaveBeenCalledWith('u1', 4, {
      enabled: false,
    });
  });

  it('toggles a rule', async () => {
    await expect(controller.toggleTimeRule('u1', 4)).resolves.toMatchObject({
      enabled: false,
    });
  });

  it('deletes a rule', async () => {
    await controller.deleteTimeRule('u1', 4);
    expect(timeRuleService.deleteTimeRule).toHaveBeenCalledWith('u1', 4);
  });

  it('checks whether streaming is allowed', async () => {
    await expect(
      controller.checkStreamingAllowed('u1', 'dev-1'),
    ).resolves.toEqual({ allowed: true, reason: 'no rules' });
  });

  describe('createPreset', () => {
    it('injects the path user id', async () => {
      await controller.createPreset('u1', { presetType: 'weekdays-only' });
      expect(timeRuleService.createPreset).toHaveBeenCalledWith({
        presetType: 'weekdays-only',
        userId: 'u1',
      });
    });

    it('maps a preset failure to a 400 carrying the message', async () => {
      timeRuleService.createPreset.mockRejectedValue(
        new Error('unknown preset'),
      );

      await expect(
        controller.createPreset('u1', { presetType: 'weekends-only' }),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        message: 'unknown preset',
      });
    });
  });
});
