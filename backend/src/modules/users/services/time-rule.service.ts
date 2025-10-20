import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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

export interface CreatePresetDto {
  userId: string;
  deviceIdentifier?: string;
  presetType: 'weekdays-only' | 'weekends-only';
}

@Injectable()
export class TimeRuleService {
  private readonly logger = new Logger(TimeRuleService.name);

  constructor(
    @InjectRepository(UserTimeRule)
    private readonly timeRuleRepository: Repository<UserTimeRule>,
    private readonly dataSource: DataSource,
  ) {}

  async createTimeRule(createDto: CreateTimeRuleDto): Promise<UserTimeRule> {
    // Validate time range
    if (!this.validateTimeRange(createDto.startTime, createDto.endTime)) {
      throw new Error('End time must be greater than start time');
    }

    // Validate day of week
    if (createDto.dayOfWeek < 0 || createDto.dayOfWeek > 6) {
      throw new Error(
        'Day of week must be between 0 (Sunday) and 6 (Saturday)',
      );
    }

    // Check for overlapping rules - need to check ALL rules for this user
    const allUserRules = await this.getAllTimeRules(createDto.userId);
    const newRule = new UserTimeRule();
    Object.assign(newRule, createDto);

    for (const existingRule of allUserRules) {
      if (newRule.overlaps(existingRule)) {
        throw new Error(
          `Rule overlaps with existing rule "${existingRule.ruleName}" on the same day and time`,
        );
      }
    }

    const timeRule = this.timeRuleRepository.create({
      ...createDto,
    });

    return await this.timeRuleRepository.save(timeRule);
  }

  async createPreset(createDto: CreatePresetDto): Promise<UserTimeRule[]> {
    this.logger.log(`Creating preset: ${createDto.presetType} for user ${createDto.userId}`);

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // First, delete all existing rules for this user/device in the transaction
      const deleteQuery = queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(UserTimeRule)
        .where('userId = :userId', { userId: createDto.userId });

      if (createDto.deviceIdentifier) {
        deleteQuery.andWhere('deviceIdentifier = :deviceIdentifier', {
          deviceIdentifier: createDto.deviceIdentifier,
        });
      } else {
        deleteQuery.andWhere('deviceIdentifier IS NULL');
      }

      await deleteQuery.execute();

      // Define preset rules based on type
      const presetRules = this.getPresetRules(
        createDto.presetType,
        createDto.deviceIdentifier,
      );
      this.logger.log(`Creating ${presetRules.length} preset rules`);

      if (presetRules.length === 0) {
        throw new Error(`Invalid preset type: ${createDto.presetType}`);
      }

      const createdRules: UserTimeRule[] = [];

      // Create all preset rules within the transaction
      for (const ruleData of presetRules) {
        // Validate time range first
        if (!this.validateTimeRange(ruleData.startTime, ruleData.endTime)) {
          throw new Error(
            `Invalid time range for rule "${ruleData.ruleName}": ${ruleData.startTime}-${ruleData.endTime}`,
          );
        }

        const ruleToCreate = {
          userId: createDto.userId,
          deviceIdentifier: createDto.deviceIdentifier || undefined,
          ruleName: ruleData.ruleName,
          action: ruleData.action,
          dayOfWeek: ruleData.dayOfWeek,
          startTime: ruleData.startTime,
          endTime: ruleData.endTime,
          enabled: true,
        };

        this.logger.debug(`Creating rule: ${JSON.stringify(ruleToCreate)}`);

        // Use the transaction-aware repository
        const newRule = queryRunner.manager.create(UserTimeRule, ruleToCreate);
        const savedRule = await queryRunner.manager.save(newRule);

        this.logger.debug(`Saved rule with ID: ${savedRule.id}, ruleName: ${savedRule.ruleName}`);
        createdRules.push(savedRule);
      }

      // Commit the transaction
      await queryRunner.commitTransaction();
      this.logger.log(`Successfully created ${createdRules.length} preset rules`);

      // Verify the rules were actually saved by querying them back
      const verifyQuery = this.timeRuleRepository
        .createQueryBuilder('rule')
        .where('rule.userId = :userId', { userId: createDto.userId });

      if (createDto.deviceIdentifier) {
        verifyQuery.andWhere('rule.deviceIdentifier = :deviceIdentifier', {
          deviceIdentifier: createDto.deviceIdentifier,
        });
      } else {
        verifyQuery.andWhere('rule.deviceIdentifier IS NULL');
      }

      const actualSavedRules = await verifyQuery.getMany();
      this.logger.log(`Verification: Found ${actualSavedRules.length} rules in database after commit`);

      return createdRules;
    } catch (error) {
      // Rollback the transaction on error
      this.logger.error(`Error creating preset: ${error.message}`, error?.stack);
      await queryRunner.rollbackTransaction();
      throw new Error(`Failed to create preset: ${error.message}`);
    } finally {
      // Release the query runner
      await queryRunner.release();
    }
  }

  private getPresetRules(
    presetType: 'weekdays-only' | 'weekends-only',
    deviceIdentifier?: string,
  ) {
    if (presetType === 'weekdays-only') {
      return [
        {
          dayOfWeek: 1,
          ruleName: 'Monday - Allow All Day',
          action: 'allow' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 2,
          ruleName: 'Tuesday - Allow All Day',
          action: 'allow' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 3,
          ruleName: 'Wednesday - Allow All Day',
          action: 'allow' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 4,
          ruleName: 'Thursday - Allow All Day',
          action: 'allow' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 5,
          ruleName: 'Friday - Allow All Day',
          action: 'allow' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 0,
          ruleName: 'Sunday - Block All Day',
          action: 'block' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 6,
          ruleName: 'Saturday - Block All Day',
          action: 'block' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
      ];
    } else if (presetType === 'weekends-only') {
      return [
        {
          dayOfWeek: 0,
          ruleName: 'Sunday - Allow All Day',
          action: 'allow' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 6,
          ruleName: 'Saturday - Allow All Day',
          action: 'allow' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 1,
          ruleName: 'Monday - Block All Day',
          action: 'block' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 2,
          ruleName: 'Tuesday - Block All Day',
          action: 'block' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 3,
          ruleName: 'Wednesday - Block All Day',
          action: 'block' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 4,
          ruleName: 'Thursday - Block All Day',
          action: 'block' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          dayOfWeek: 5,
          ruleName: 'Friday - Block All Day',
          action: 'block' as const,
          startTime: '00:00',
          endTime: '23:59',
        },
      ];
    }

    return [];
  }

  async getTimeRules(
    userId: string,
    deviceIdentifier?: string,
  ): Promise<UserTimeRule[]> {
    const queryBuilder = this.timeRuleRepository
      .createQueryBuilder('rule')
      .where('rule.userId = :userId', { userId });

    if (deviceIdentifier) {
      queryBuilder.andWhere('rule.deviceIdentifier = :deviceIdentifier', {
        deviceIdentifier,
      });
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
    if (
      updateDto.dayOfWeek !== undefined &&
      (updateDto.dayOfWeek < 0 || updateDto.dayOfWeek > 6)
    ) {
      throw new Error(
        'Day of week must be between 0 (Sunday) and 6 (Saturday)',
      );
    }

    // Check for overlapping rules if relevant fields are being updated
    if (
      updateDto.dayOfWeek !== undefined ||
      updateDto.startTime ||
      updateDto.endTime
    ) {
      const existingRules = await this.getAllTimeRules(userId);
      const tempRule = new UserTimeRule();
      Object.assign(tempRule, updatedRule);

      for (const existingRule of existingRules) {
        if (tempRule.overlaps(existingRule)) {
          throw new Error(
            `Updated rule would overlap with existing rule "${existingRule.ruleName}"`,
          );
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

    const allRules = [...deviceRules, ...userRules].filter(
      (rule) => rule.enabled && rule.dayOfWeek === dayOfWeek,
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

  private isTimeInRange(
    currentTime: string,
    startTime: string,
    endTime: string,
  ): boolean {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const current = currentHour * 60 + currentMinute;
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;

    return current >= start && current < end;
  }
}
