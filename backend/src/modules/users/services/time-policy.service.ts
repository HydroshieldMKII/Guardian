import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTimeRule } from '../../../entities/user-time-rule.entity';

export interface CreateTimePolicyDto {
  userId: string;
  deviceIdentifier?: string;
  policyName: string;
  action: 'allow' | 'block';
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  priority?: number;
}

export interface UpdateTimePolicyDto {
  policyName?: string;
  enabled?: boolean;
  action?: 'allow' | 'block';
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  priority?: number;
}

@Injectable()
export class TimePolicyService {
  constructor(
    @InjectRepository(UserTimeRule)
    private readonly timeRuleRepository: Repository<UserTimeRule>,
  ) {}

  async createTimePolicy(
    createDto: CreateTimePolicyDto,
  ): Promise<UserTimeRule> {
    const policy = this.timeRuleRepository.create({
      userId: createDto.userId,
      deviceIdentifier: createDto.deviceIdentifier || undefined,
      ruleName: createDto.policyName,
      action: createDto.action,
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

    const now = new Date();
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, etc.
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm format

    // Check each policy (no priority sorting needed)
    for (const policy of enabledPolicies) {
      if (this.isPolicyActive(policy, currentDay, currentTime)) {
        return policy.action === 'allow';
      }
    }

    return true; // No matching policy = allow by default
  }

  private isPolicyActive(
    policy: UserTimeRule,
    currentDay: number,
    currentTime: string,
  ): boolean {
    // Check if current day matches the policy's day
    if (policy.dayOfWeek !== currentDay) {
      return false;
    }

    // Check if current time is within the policy's time range
    const start = policy.startTime;
    const end = policy.endTime;

    // Handle time range that spans midnight (e.g., 22:00 to 06:00)
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    } else {
      return currentTime >= start && currentTime <= end;
    }
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
      return `${policy.action.toUpperCase()}: ${day} ${policy.startTime}-${policy.endTime}`;
    });

    return summaries.join('; ');
  }

  private formatDayOfWeek(day: number): string {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames[day] || 'Invalid Day';
  }
}
