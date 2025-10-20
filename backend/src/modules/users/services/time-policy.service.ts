import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTimePolicy } from '../../../entities/user-time-policy.entity';

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
    @InjectRepository(UserTimePolicy)
    private readonly timePolicyRepository: Repository<UserTimePolicy>,
  ) {}

  async createTimePolicy(
    createDto: CreateTimePolicyDto,
  ): Promise<UserTimePolicy> {
    const policy = this.timePolicyRepository.create({
      userId: createDto.userId,
      deviceIdentifier: createDto.deviceIdentifier || undefined,
      policyName: createDto.policyName,
      action: createDto.action,
      daysOfWeek: createDto.daysOfWeek,
      startTime: createDto.startTime,
      endTime: createDto.endTime,
      priority: createDto.priority || 0,
    });

    return this.timePolicyRepository.save(policy);
  }

  async getTimePolicies(userId: string): Promise<UserTimePolicy[]> {
    return this.timePolicyRepository.find({
      where: { userId },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async getTimePoliciesForDevice(
    userId: string,
    deviceIdentifier: string,
  ): Promise<UserTimePolicy[]> {
    return this.timePolicyRepository.find({
      where: [
        { userId, deviceIdentifier },
        { userId, deviceIdentifier: undefined }, // User-wide policies
      ],
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async updateTimePolicy(
    id: number,
    updateDto: UpdateTimePolicyDto,
  ): Promise<UserTimePolicy | null> {
    await this.timePolicyRepository.update(id, updateDto);
    return this.timePolicyRepository.findOne({ where: { id } });
  }

  async deleteTimePolicy(id: number): Promise<void> {
    await this.timePolicyRepository.delete(id);
  }

  async toggleTimePolicy(id: number): Promise<UserTimePolicy> {
    const policy = await this.timePolicyRepository.findOne({ where: { id } });
    if (!policy) {
      throw new Error('Time policy not found');
    }

    policy.enabled = !policy.enabled;
    return this.timePolicyRepository.save(policy);
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

    // Sort by priority (highest first) and check each policy
    const sortedPolicies = enabledPolicies.sort(
      (a, b) => b.priority - a.priority,
    );

    for (const policy of sortedPolicies) {
      if (this.isPolicyActive(policy, currentDay, currentTime)) {
        return policy.action === 'allow';
      }
    }

    return true; // No matching policy = allow by default
  }

  private isPolicyActive(
    policy: UserTimePolicy,
    currentDay: number,
    currentTime: string,
  ): boolean {
    // Check if current day is in the policy's days
    if (!policy.daysOfWeek.includes(currentDay)) {
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
      const days = this.formatDaysOfWeek(policy.daysOfWeek);
      return `${policy.action.toUpperCase()}: ${days} ${policy.startTime}-${policy.endTime}`;
    });

    return summaries.join('; ');
  }

  private formatDaysOfWeek(days: number[]): string {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sortedDays = days.sort((a, b) => a - b);

    if (sortedDays.length === 7) {
      return 'Daily';
    }

    if (
      sortedDays.length === 5 &&
      sortedDays.every((day) => day >= 1 && day <= 5)
    ) {
      return 'Weekdays';
    }

    if (
      sortedDays.length === 2 &&
      sortedDays.includes(0) &&
      sortedDays.includes(6)
    ) {
      return 'Weekends';
    }

    return sortedDays.map((day) => dayNames[day]).join(', ');
  }
}
