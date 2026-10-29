import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { UserTimeRule } from '@/entities/user-time-rule.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import {
  CreatePresetDto,
  TimeRuleService,
} from '@/modules/users/services/time-rule.service';
import type { Mock } from 'vitest';

const rule = (overrides: Partial<UserTimeRule> = {}): UserTimeRule =>
  Object.assign(new UserTimeRule(), {
    id: 1,
    userId: 'u1',
    ruleName: 'Bedtime',
    enabled: true,
    dayOfWeek: 1,
    startTime: '22:00',
    endTime: '23:30',
    ...overrides,
  });

describe('TimeRuleService', () => {
  let service: TimeRuleService;
  let repository: Record<
    'create' | 'save' | 'find' | 'findOne' | 'remove',
    Mock
  >;
  let configService: { getCurrentTimeInTimezone: Mock };
  let transaction: Mock;
  let presetManager: {
    delete: Mock;
    create: Mock;
    save: Mock;
  };

  beforeEach(async () => {
    let nextId = 100;
    presetManager = {
      delete: vi.fn().mockResolvedValue({ affected: 0 }),
      create: vi.fn((_entity, value: Partial<UserTimeRule>) => rule(value)),
      save: vi.fn((value: UserTimeRule) =>
        Promise.resolve(Object.assign(value, { id: nextId++ })),
      ),
    };
    transaction = vi.fn(
      (work: (manager: typeof presetManager) => Promise<unknown>) =>
        work(presetManager),
    );

    repository = {
      create: vi.fn((value: Partial<UserTimeRule>) => rule(value)),
      save: vi.fn((value: UserTimeRule) => Promise.resolve(value)),
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const dataSource = { manager: { transaction } };
    configService = {
      getCurrentTimeInTimezone: vi
        .fn()
        .mockResolvedValue(new Date('2026-01-05T09:00:00Z')),
    };

    const module = await Test.createTestingModule({
      providers: [
        TimeRuleService,
        { provide: getRepositoryToken(UserTimeRule), useValue: repository },
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(TimeRuleService);
  });

  describe('createTimeRule', () => {
    const validRule = {
      userId: 'u1',
      ruleName: 'Bedtime',
      dayOfWeek: 1,
      startTime: '22:00',
      endTime: '23:30',
    };

    it('persists a valid rule', async () => {
      await service.createTimeRule(validRule);
      expect(repository.save).toHaveBeenCalled();
    });

    it('rejects an end time before the start', async () => {
      await expect(
        service.createTimeRule({
          ...validRule,
          startTime: '23:00',
          endTime: '22:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('tells the user to split an overnight rule across two days', async () => {
      await expect(
        service.createTimeRule({
          ...validRule,
          startTime: '22:00',
          endTime: '06:00',
        }),
      ).rejects.toThrow(/split it into one rule ending at 23:59/);
    });

    it('rejects an end time equal to the start', async () => {
      await expect(
        service.createTimeRule({
          ...validRule,
          startTime: '22:00',
          endTime: '22:00',
        }),
      ).rejects.toThrow('End time must be greater than start time');
    });

    it.each([-1, 7])('rejects day %s', async (dayOfWeek) => {
      await expect(
        service.createTimeRule({ ...validRule, dayOfWeek }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a fractional day', async () => {
      await expect(
        service.createTimeRule({ ...validRule, dayOfWeek: 1.5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a rule overlapping an existing one', async () => {
      repository.find.mockResolvedValue([
        rule({
          id: 9,
          ruleName: 'Existing',
          startTime: '22:30',
          endTime: '23:00',
        }),
      ]);

      const failure = service.createTimeRule(validRule);
      await expect(failure).rejects.toThrow(ConflictException);
      await expect(failure).rejects.toThrow(
        'Rule overlaps with existing rule "Existing"',
      );
    });

    it('reports a clash between a device rule and a user-wide rule as a conflict', async () => {
      repository.find.mockResolvedValue([
        rule({ id: 9, ruleName: 'Everyone', deviceIdentifier: undefined }),
      ]);

      await expect(
        service.createTimeRule({ ...validRule, deviceIdentifier: 'device-a' }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows a rule that starts where another one ends', async () => {
      repository.find.mockResolvedValue([
        rule({ id: 9, startTime: '23:30', endTime: '23:59' }),
      ]);

      await expect(service.createTimeRule(validRule)).resolves.toBeDefined();
    });

    it('allows a rule that does not overlap', async () => {
      repository.find.mockResolvedValue([
        rule({ id: 9, startTime: '08:00', endTime: '09:00' }),
      ]);

      await expect(service.createTimeRule(validRule)).resolves.toBeDefined();
    });
  });

  describe('createPreset', () => {
    it('creates the two weekend-blocking rules', async () => {
      const created = await service.createPreset({
        userId: 'u1',
        presetType: 'weekdays-only',
      });

      expect(created).toHaveLength(2);
      expect(created.map((r) => r.dayOfWeek).sort()).toEqual([0, 6]);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(presetManager.delete).toHaveBeenCalledWith(UserTimeRule, {
        userId: 'u1',
        deviceIdentifier: IsNull(),
      });
    });

    it('creates the five weekday-blocking rules', async () => {
      const created = await service.createPreset({
        userId: 'u1',
        presetType: 'weekends-only',
      });

      expect(created).toHaveLength(5);
      expect(created.map((r) => r.dayOfWeek)).toEqual([1, 2, 3, 4, 5]);
    });

    it('scopes the preset to a device when one is given', async () => {
      const created = await service.createPreset({
        userId: 'u1',
        deviceIdentifier: 'device-a',
        presetType: 'weekdays-only',
      });

      expect(created[0].deviceIdentifier).toBe('device-a');
      expect(presetManager.delete).toHaveBeenCalledWith(UserTimeRule, {
        userId: 'u1',
        deviceIdentifier: 'device-a',
      });
    });

    it('rethrows a failure inside the transaction', async () => {
      presetManager.save.mockRejectedValue(new Error('db down'));

      await expect(
        service.createPreset({ userId: 'u1', presetType: 'weekdays-only' }),
      ).rejects.toThrow('Failed to create preset: db down');
    });

    it('rejects an unknown preset type without touching the rules', async () => {
      await expect(
        service.createPreset({
          userId: 'u1',
          presetType: 'fortnightly' as CreatePresetDto['presetType'],
        }),
      ).rejects.toThrow('Failed to create preset: Invalid preset type');

      expect(transaction).not.toHaveBeenCalled();
    });
  });

  describe('getTimeRules', () => {
    it('restricts to user-wide rules when no device is given', async () => {
      await service.getTimeRules('u1');
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'u1', deviceIdentifier: IsNull() },
        order: { dayOfWeek: 'ASC', startTime: 'ASC' },
      });
    });

    it('restricts to a device when one is given', async () => {
      await service.getTimeRules('u1', 'device-a');
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'u1', deviceIdentifier: 'device-a' },
        order: { dayOfWeek: 'ASC', startTime: 'ASC' },
      });
    });
  });

  describe('getAllTimeRules', () => {
    it('orders by day then start time', async () => {
      await service.getAllTimeRules('u1');
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        order: { dayOfWeek: 'ASC', startTime: 'ASC' },
      });
    });
  });

  describe('updateTimeRule', () => {
    it('throws when the rule is missing', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.updateTimeRule('u1', 1, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('applies a simple rename without validation', async () => {
      repository.findOne.mockResolvedValue(rule());
      const updated = await service.updateTimeRule('u1', 1, {
        ruleName: 'Renamed',
      });
      expect(updated?.ruleName).toBe('Renamed');
    });

    it('rejects an invalid updated time range', async () => {
      repository.findOne.mockResolvedValue(rule());
      await expect(
        service.updateTimeRule('u1', 1, { startTime: '23:45' }),
      ).rejects.toThrow('End time must be greater than start time');
    });

    it('rejects an out-of-range day', async () => {
      repository.findOne.mockResolvedValue(rule());
      await expect(
        service.updateTimeRule('u1', 1, { dayOfWeek: 9 }),
      ).rejects.toThrow(
        'Day of week must be between 0 (Sunday) and 6 (Saturday)',
      );
    });

    it('rejects an update that would overlap another rule', async () => {
      repository.findOne.mockResolvedValue(rule({ id: 1 }));
      repository.find.mockResolvedValue([
        rule({
          id: 2,
          ruleName: 'Other',
          startTime: '08:00',
          endTime: '12:00',
        }),
      ]);

      await expect(
        service.updateTimeRule('u1', 1, {
          startTime: '09:00',
          endTime: '10:00',
        }),
      ).rejects.toThrow(
        'Updated rule would overlap with existing rule "Other"',
      );
    });

    it('accepts a non-overlapping time change', async () => {
      repository.findOne.mockResolvedValue(rule({ id: 1 }));
      repository.find.mockResolvedValue([
        rule({ id: 2, startTime: '08:00', endTime: '09:00' }),
      ]);

      await expect(
        service.updateTimeRule('u1', 1, {
          startTime: '18:00',
          endTime: '19:00',
        }),
      ).resolves.toBeDefined();
    });

    it('toggles the enabled flag without time validation', async () => {
      repository.findOne.mockResolvedValue(rule());
      const updated = await service.updateTimeRule('u1', 1, { enabled: false });
      expect(updated?.enabled).toBe(false);
    });
  });

  describe('deleteTimeRule', () => {
    it('removes an existing rule', async () => {
      const existing = rule();
      repository.findOne.mockResolvedValue(existing);

      await service.deleteTimeRule('u1', 1);
      expect(repository.remove).toHaveBeenCalledWith(existing);
    });

    it('throws when the rule is missing', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.deleteTimeRule('u1', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleTimeRule', () => {
    it('flips an enabled rule off', async () => {
      repository.findOne.mockResolvedValue(rule({ enabled: true }));
      const result = await service.toggleTimeRule('u1', 1);
      expect(result.enabled).toBe(false);
    });

    it('flips a disabled rule on', async () => {
      repository.findOne.mockResolvedValue(rule({ enabled: false }));
      const result = await service.toggleTimeRule('u1', 1);
      expect(result.enabled).toBe(true);
    });

    it('throws when the rule is missing', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.toggleTimeRule('u1', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('checkStreamingAllowed', () => {
    const monday9am = new Date('2026-01-05T09:00:00Z');

    it('allows when no rules match', async () => {
      repository.find.mockResolvedValue([]);
      await expect(
        service.checkStreamingAllowed('u1', undefined, monday9am),
      ).resolves.toEqual({
        allowed: true,
        reason: 'No time restrictions apply',
      });
    });

    it('blocks inside a matching window', async () => {
      repository.find.mockResolvedValue([
        rule({ dayOfWeek: 1, startTime: '08:00', endTime: '10:00' }),
      ]);

      await expect(
        service.checkStreamingAllowed('u1', undefined, monday9am),
      ).resolves.toEqual({
        allowed: false,
        reason: 'Blocked by rule "Bedtime" (08:00-10:00)',
      });
    });

    it('ignores rules for another day', async () => {
      repository.find.mockResolvedValue([
        rule({ dayOfWeek: 3, startTime: '08:00', endTime: '10:00' }),
      ]);

      const result = await service.checkStreamingAllowed(
        'u1',
        undefined,
        monday9am,
      );
      expect(result.allowed).toBe(true);
    });

    it('ignores disabled rules', async () => {
      repository.find.mockResolvedValue([
        rule({
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '10:00',
          enabled: false,
        }),
      ]);

      const result = await service.checkStreamingAllowed(
        'u1',
        undefined,
        monday9am,
      );
      expect(result.allowed).toBe(true);
    });

    it('treats the window end as inclusive, as enforcement does', async () => {
      repository.find.mockResolvedValue([
        rule({ dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }),
      ]);

      const result = await service.checkStreamingAllowed(
        'u1',
        undefined,
        monday9am,
      );
      expect(result.allowed).toBe(false);
    });

    it('treats the window start as inclusive', async () => {
      repository.find.mockResolvedValue([
        rule({ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }),
      ]);

      const result = await service.checkStreamingAllowed(
        'u1',
        undefined,
        monday9am,
      );
      expect(result.allowed).toBe(false);
    });

    it('blocks a legacy rule stored without zero padding', async () => {
      repository.find.mockResolvedValue([
        rule({ dayOfWeek: 1, startTime: '8:05', endTime: '9:30' }),
      ]);

      const result = await service.checkStreamingAllowed(
        'u1',
        undefined,
        monday9am,
      );
      expect(result.allowed).toBe(false);
    });

    it('uses the configured timezone clock when no time is given', async () => {
      repository.find.mockResolvedValue([
        rule({ dayOfWeek: 2, startTime: '01:00', endTime: '02:00' }),
      ]);
      configService.getCurrentTimeInTimezone.mockResolvedValue(
        new Date('2026-01-06T01:30:00Z'),
      );

      const result = await service.checkStreamingAllowed('u1');
      expect(result.allowed).toBe(false);
    });

    it('also consults device rules when a device is given', async () => {
      repository.find.mockResolvedValue([]);
      await service.checkStreamingAllowed('u1', 'device-a', monday9am);
      expect(repository.find).toHaveBeenCalledTimes(2);
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'u1', deviceIdentifier: 'device-a' },
        order: { dayOfWeek: 'ASC', startTime: 'ASC' },
      });
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'u1', deviceIdentifier: IsNull() },
        order: { dayOfWeek: 'ASC', startTime: 'ASC' },
      });
    });
  });
});
