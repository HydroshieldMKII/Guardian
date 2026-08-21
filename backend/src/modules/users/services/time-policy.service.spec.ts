import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTimeRule } from '../../../entities/user-time-rule.entity';
import { ConfigService } from '../../config/services/config.service';
import { TimePolicyService } from './time-policy.service';

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

describe('TimePolicyService', () => {
  let service: TimePolicyService;
  let repository: jest.Mocked<Repository<UserTimeRule>>;
  let configService: { getCurrentTimeInTimezone: jest.Mock };

  beforeEach(async () => {
    repository = {
      create: jest.fn((value: Partial<UserTimeRule>) => rule(value)),
      save: jest.fn((value: UserTimeRule) => Promise.resolve(value)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as jest.Mocked<Repository<UserTimeRule>>;

    configService = {
      getCurrentTimeInTimezone: jest
        .fn()
        .mockResolvedValue(new Date('2026-01-05T23:00:00.000Z')),
    };

    const module = await Test.createTestingModule({
      providers: [
        TimePolicyService,
        { provide: getRepositoryToken(UserTimeRule), useValue: repository },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(TimePolicyService);
  });

  describe('createTimePolicy', () => {
    it('maps the first selected day onto the rule', async () => {
      await service.createTimePolicy({
        userId: 'u1',
        policyName: 'Bedtime',
        daysOfWeek: [3, 4],
        startTime: '22:00',
        endTime: '23:00',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ dayOfWeek: 3, ruleName: 'Bedtime' }),
      );
    });

    it('defaults to Sunday when no day is supplied', async () => {
      await service.createTimePolicy({
        userId: 'u1',
        policyName: 'Bedtime',
        daysOfWeek: [],
        startTime: '22:00',
        endTime: '23:00',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ dayOfWeek: 0 }),
      );
    });

    it('normalizes a blank device identifier to undefined', async () => {
      await service.createTimePolicy({
        userId: 'u1',
        deviceIdentifier: '',
        policyName: 'Bedtime',
        daysOfWeek: [1],
        startTime: '22:00',
        endTime: '23:00',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ deviceIdentifier: undefined }),
      );
    });

    it('enables the policy on creation', async () => {
      await service.createTimePolicy({
        userId: 'u1',
        policyName: 'Bedtime',
        daysOfWeek: [1],
        startTime: '22:00',
        endTime: '23:00',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
      );
    });
  });

  describe('lookups', () => {
    it('lists policies for a user in creation order', async () => {
      await service.getTimePolicies('u1');
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        order: { createdAt: 'ASC' },
      });
    });

    it('includes user-wide policies when querying a device', async () => {
      await service.getTimePoliciesForDevice('u1', 'device-a');
      expect(repository.find).toHaveBeenCalledWith({
        where: [
          { userId: 'u1', deviceIdentifier: 'device-a' },
          { userId: 'u1', deviceIdentifier: undefined },
        ],
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('updateTimePolicy', () => {
    it('returns the reloaded policy', async () => {
      const updated = rule({ ruleName: 'Renamed' });
      repository.findOne.mockResolvedValue(updated);

      await expect(
        service.updateTimePolicy(1, { ruleName: 'Renamed' }),
      ).resolves.toBe(updated);
      expect(repository.update).toHaveBeenCalledWith(1, {
        ruleName: 'Renamed',
      });
    });

    it('throws when the policy disappears', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.updateTimePolicy(1, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('deleteTimePolicy', () => {
    it('delegates to the repository', async () => {
      await service.deleteTimePolicy(5);
      expect(repository.delete).toHaveBeenCalledWith(5);
    });
  });

  describe('toggleTimePolicy', () => {
    it('flips an enabled policy off', async () => {
      repository.findOne.mockResolvedValue(rule({ enabled: true }));
      const result = await service.toggleTimePolicy(1);
      expect(result.enabled).toBe(false);
    });

    it('flips a disabled policy on', async () => {
      repository.findOne.mockResolvedValue(rule({ enabled: false }));
      const result = await service.toggleTimePolicy(1);
      expect(result.enabled).toBe(true);
    });

    it('throws when the policy is missing', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.toggleTimePolicy(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('isTimeScheduleAllowed', () => {
    it('allows when no policies exist', async () => {
      repository.find.mockResolvedValue([]);
      await expect(service.isTimeScheduleAllowed('u1')).resolves.toBe(true);
    });

    it('allows when every policy is disabled', async () => {
      repository.find.mockResolvedValue([rule({ enabled: false })]);
      await expect(service.isTimeScheduleAllowed('u1')).resolves.toBe(true);
    });

    it('blocks inside an active blocking window', async () => {
      repository.find.mockResolvedValue([
        rule({ dayOfWeek: 1, startTime: '22:00', endTime: '23:30' }),
      ]);
      await expect(service.isTimeScheduleAllowed('u1')).resolves.toBe(false);
    });

    it('allows outside the window', async () => {
      repository.find.mockResolvedValue([
        rule({ dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }),
      ]);
      await expect(service.isTimeScheduleAllowed('u1')).resolves.toBe(true);
    });

    it('allows on a different day', async () => {
      repository.find.mockResolvedValue([
        rule({ dayOfWeek: 5, startTime: '22:00', endTime: '23:30' }),
      ]);
      await expect(service.isTimeScheduleAllowed('u1')).resolves.toBe(true);
    });

    it('blocks on the inclusive window boundaries', async () => {
      repository.find.mockResolvedValue([
        rule({ dayOfWeek: 1, startTime: '23:00', endTime: '23:00' }),
      ]);
      await expect(service.isTimeScheduleAllowed('u1')).resolves.toBe(false);
    });

    it('queries device-scoped policies when a device is given', async () => {
      await service.isTimeScheduleAllowed('u1', 'device-a');
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            { userId: 'u1', deviceIdentifier: 'device-a' },
          ]),
        }),
      );
    });
  });

  describe('getPolicySummary', () => {
    it('reports no restrictions when nothing is enabled', async () => {
      repository.find.mockResolvedValue([]);
      await expect(service.getPolicySummary('u1')).resolves.toBe(
        'No time restrictions',
      );
    });

    it('describes a single blocking window', async () => {
      repository.find.mockResolvedValue([
        rule({ dayOfWeek: 1, startTime: '22:00', endTime: '23:30' }),
      ]);
      await expect(service.getPolicySummary('u1')).resolves.toBe(
        'BLOCK: Mon 22:00-23:30',
      );
    });

    it('joins several windows', async () => {
      repository.find.mockResolvedValue([
        rule({ id: 1, dayOfWeek: 0, startTime: '01:00', endTime: '02:00' }),
        rule({ id: 2, dayOfWeek: 6, startTime: '03:00', endTime: '04:00' }),
      ]);
      await expect(service.getPolicySummary('u1')).resolves.toBe(
        'BLOCK: Sun 01:00-02:00; BLOCK: Sat 03:00-04:00',
      );
    });

    it('labels an out-of-range day defensively', async () => {
      repository.find.mockResolvedValue([rule({ dayOfWeek: 9 })]);
      await expect(service.getPolicySummary('u1')).resolves.toContain(
        'Invalid Day',
      );
    });

    it('ignores disabled policies', async () => {
      repository.find.mockResolvedValue([rule({ enabled: false })]);
      await expect(service.getPolicySummary('u1')).resolves.toBe(
        'No time restrictions',
      );
    });
  });
});
