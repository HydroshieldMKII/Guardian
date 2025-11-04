import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTimeRule } from '../../../entities/user-time-rule.entity';
import { ConfigService } from '../../config/services/config.service';

export interface CreateTimePolicyDto {
  userId: string;
  deviceIdentifier?: string;
  policyName: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  priority?: number;
}

export interface UpdateTimePolicyDto {
  policyName?: string;
  enabled?: boolean;
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  priority?: number;
}

@Injectable()
export class TimePolicyService {
  private readonly logger = new Logger(TimePolicyService.name);
  private readonly DAY_NAMES = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  private readonly DAY_NAMES_SHORT = [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
  ];

  constructor(
    @InjectRepository(UserTimeRule)
    private readonly timeRuleRepository: Repository<UserTimeRule>,
    private readonly configService: ConfigService,
  ) {}

  async createTimePolicy(
    createDto: CreateTimePolicyDto,
  ): Promise<UserTimeRule> {
    const policy = this.timeRuleRepository.create({
      userId: createDto.userId,
      deviceIdentifier: createDto.deviceIdentifier || undefined,
      ruleName: createDto.policyName,
      dayOfWeek: createDto.daysOfWeek[0] || 0, // Take first day or default to Sunday
      startTime: createDto.startTime,
      endTime: createDto.endTime,
      enabled: true,
    });

    return this.timeRuleRepository.save(policy);
  }

  async getTimePolicies(userId: string): Promise<UserTimeRule[]> {
    return this.timeRuleRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async getTimePoliciesForDevice(
    userId: string,
    deviceIdentifier: string,
  ): Promise<UserTimeRule[]> {
    return this.timeRuleRepository.find({
      where: [
        { userId, deviceIdentifier },
        { userId, deviceIdentifier: undefined }, // User-wide policies
      ],
      order: { createdAt: 'ASC' },
    });
  }

  async updateTimePolicy(
    id: number,
    updates: Partial<UserTimeRule>,
  ): Promise<UserTimeRule> {
    await this.timeRuleRepository.update(id, updates);
    const updated = await this.timeRuleRepository.findOne({ where: { id } });
    if (!updated) {
      throw new NotFoundException('Time rule not found');
    }
    return updated;
  }

  async deleteTimePolicy(id: number): Promise<void> {
    await this.timeRuleRepository.delete(id);
  }

  async toggleTimePolicy(id: number): Promise<UserTimeRule> {
    const policy = await this.timeRuleRepository.findOne({ where: { id } });
    if (!policy) {
      throw new NotFoundException('Time rule not found');
    }

    policy.enabled = !policy.enabled;
    return this.timeRuleRepository.save(policy);
  }

  /**
   * Check if a user/device is allowed to stream at the current time
   */
  async isTimeScheduleAllowed(
    userId: string,
    deviceIdentifier?: string,
  ): Promise<boolean> {
    const policies = deviceIdentifier
      ? await this.getTimePoliciesForDevice(userId, deviceIdentifier)
      : await this.getTimePolicies(userId);

    const enabledPolicies = policies.filter((policy) => policy.enabled);

    if (enabledPolicies.length === 0) {
      return true; // No policies = allow by default
    }

    const timezonedDate = await this.configService.getCurrentTimeInTimezone();
    const currentDay = timezonedDate.getDay(); // 0=Sunday, 1=Monday, etc.
    const currentTime = timezonedDate.toISOString().substring(11, 16); // Extract HH:MM from ISO string

    // Check each policy
    for (const policy of enabledPolicies) {
      const isActive = this.isPolicyActive(policy, currentDay, currentTime);
      if (isActive) {
        // All rules are blocking rules
        return false;
      }
    }

    return true; // No matching policy = allow by default
  }

  private isPolicyActive(
    policy: UserTimeRule,
    currentDay: number,
    currentTime: string,
  ): boolean {
    if (policy.dayOfWeek !== currentDay) {
      return false;
    }

    return currentTime >= policy.startTime && currentTime <= policy.endTime;
  }

  /**
   * Get a descriptive summary of current time policies for a user/device
   */
  async getPolicySummary(
    userId: string,
    deviceIdentifier?: string,
  ): Promise<string> {
    const policies = deviceIdentifier
      ? await this.getTimePoliciesForDevice(userId, deviceIdentifier)
      : await this.getTimePolicies(userId);

    const enabledPolicies = policies.filter((policy) => policy.enabled);

    if (enabledPolicies.length === 0) {
      return 'No time restrictions';
    }

    const summaries = enabledPolicies.map((policy) => {
      const day = this.formatDayOfWeek(policy.dayOfWeek);
      return `BLOCK: ${day} ${policy.startTime}-${policy.endTime}`;
    });

    return summaries.join('; ');
  }

  private formatDayOfWeek(day: number): string {
    return this.DAY_NAMES_SHORT[day] || 'Invalid Day';
  }
}
