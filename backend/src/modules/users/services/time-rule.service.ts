import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTimeRule } from '../../../entities/user-time-rule.entity';

export interface CreateTimeRuleDto {
  userId: string;
  deviceIdentifier?: string;
  ruleName: string;
  action: 'allow' | 'block';
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface UpdateTimeRuleDto {
  ruleName?: string;
  enabled?: boolean;
  action?: 'allow' | 'block';
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
}

@Injectable()
export class TimeRuleService {
  constructor(
    @InjectRepository(UserTimeRule)
    private readonly timeRuleRepository: Repository<UserTimeRule>,
  ) {}

  async createTimeRule(createDto: CreateTimeRuleDto): Promise<UserTimeRule> {
    // Validate time range
    if (!this.validateTimeRange(createDto.startTime, createDto.endTime)) {
      throw new Error('End time must be greater than start time');
    }

    // Validate day of week
    if (createDto.dayOfWeek < 0 || createDto.dayOfWeek > 6) {
      throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    // Check for overlapping rules - need to check ALL rules for this user
    const allUserRules = await this.getAllTimeRules(createDto.userId);
    const newRule = new UserTimeRule();
    Object.assign(newRule, createDto);

    for (const existingRule of allUserRules) {
      if (newRule.overlaps(existingRule)) {
        throw new Error(`Rule overlaps with existing rule "${existingRule.ruleName}" on the same day and time`);
      }
    }

    const timeRule = this.timeRuleRepository.create({
      ...createDto,
    });

    return await this.timeRuleRepository.save(timeRule);
  }

  async getTimeRules(userId: string, deviceIdentifier?: string): Promise<UserTimeRule[]> {
    const queryBuilder = this.timeRuleRepository
      .createQueryBuilder('rule')
      .where('rule.userId = :userId', { userId });

    if (deviceIdentifier) {
      queryBuilder.andWhere('rule.deviceIdentifier = :deviceIdentifier', { deviceIdentifier });
    } else {
      queryBuilder.andWhere('rule.deviceIdentifier IS NULL');
    }

    return await queryBuilder
      .orderBy('rule.dayOfWeek', 'ASC')
      .addOrderBy('rule.startTime', 'ASC')
      .getMany();
  }

  async getAllTimeRules(userId: string): Promise<UserTimeRule[]> {
    return await this.timeRuleRepository.find({
      where: { userId },
      order: {
        dayOfWeek: 'ASC',
        startTime: 'ASC',
      },
    });
  }

  async updateTimeRule(
    userId: string,
    ruleId: number,
    updateDto: UpdateTimeRuleDto,
  ): Promise<UserTimeRule | null> {
    const rule = await this.timeRuleRepository.findOne({
      where: { id: ruleId, userId },
    });

    if (!rule) {
      throw new Error('Time rule not found');
    }

    // Create a temporary rule with updated values for validation
    const updatedRule = { ...rule, ...updateDto };

    // Validate time range if times are being updated
    if (updateDto.startTime || updateDto.endTime) {
      const startTime = updateDto.startTime || rule.startTime;
      const endTime = updateDto.endTime || rule.endTime;
      
      if (!this.validateTimeRange(startTime, endTime)) {
        throw new Error('End time must be greater than start time');
      }
    }

    // Validate day of week if being updated
    if (updateDto.dayOfWeek !== undefined && (updateDto.dayOfWeek < 0 || updateDto.dayOfWeek > 6)) {
      throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    // Check for overlapping rules if relevant fields are being updated
    if (updateDto.dayOfWeek !== undefined || updateDto.startTime || updateDto.endTime) {
      const existingRules = await this.getAllTimeRules(userId);
      const tempRule = new UserTimeRule();
      Object.assign(tempRule, updatedRule);

      for (const existingRule of existingRules) {
        if (tempRule.overlaps(existingRule)) {
          throw new Error(`Updated rule would overlap with existing rule "${existingRule.ruleName}"`);
        }
      }
    }

    // Apply updates
    Object.assign(rule, updateDto);
    return await this.timeRuleRepository.save(rule);
  }

  async deleteTimeRule(userId: string, ruleId: number): Promise<void> {
    const rule = await this.timeRuleRepository.findOne({
      where: { id: ruleId, userId },
    });

    if (!rule) {
      throw new Error('Time rule not found');
    }

    await this.timeRuleRepository.remove(rule);
  }

  async toggleTimeRule(userId: string, ruleId: number): Promise<UserTimeRule> {
    const rule = await this.timeRuleRepository.findOne({
      where: { id: ruleId, userId },
    });

    if (!rule) {
      throw new Error('Time rule not found');
    }

    rule.enabled = !rule.enabled;
    return await this.timeRuleRepository.save(rule);
  }

  async checkStreamingAllowed(
    userId: string,
    deviceIdentifier?: string,
    currentTime?: Date,
  ): Promise<{ allowed: boolean; reason: string }> {
    const now = currentTime || new Date();
    const dayOfWeek = now.getDay();
    const timeStr = now.toTimeString().slice(0, 5); // HH:MM format

    // Get all applicable rules (device-specific and user-wide)
    const deviceRules = deviceIdentifier 
      ? await this.getTimeRules(userId, deviceIdentifier)
      : [];
    const userRules = await this.getTimeRules(userId);
    
    const allRules = [...deviceRules, ...userRules].filter(rule => 
      rule.enabled && rule.dayOfWeek === dayOfWeek
    );

    // Check if current time falls within any rule's time range
    for (const rule of allRules) {
      if (this.isTimeInRange(timeStr, rule.startTime, rule.endTime)) {
        if (rule.action === 'block') {
          return {
            allowed: false,
            reason: `Blocked by rule "${rule.ruleName}" (${rule.startTime}-${rule.endTime})`,
          };
        }
        // If we find an 'allow' rule, streaming is explicitly allowed
        return {
          allowed: true,
          reason: `Allowed by rule "${rule.ruleName}"`,
        };
      }
    }

    // No matching rules found - default behavior (could be configurable)
    return {
      allowed: true,
      reason: 'No time restrictions apply',
    };
  }

  private validateTimeRange(startTime: string, endTime: string): boolean {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    return endMinutes > startMinutes;
  }

  private isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const current = currentHour * 60 + currentMinute;
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    
    return current >= start && current < end;
  }
}