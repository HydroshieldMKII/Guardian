import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { UserTimeRule } from '@/entities/user-time-rule.entity';
import { asHttpError, errorMessage } from '@/common/utils/error-types';
import { isScheduleActive, readClock } from '@/common/utils/time-of-day';
import { ConfigService } from '@/modules/config/services/config.service';
import { serialTransaction } from '@/database/serial-transaction';
import {
  TimeRulePreset,
  presetRules,
} from '@/modules/users/services/time-rule-presets';

export interface CreateTimeRuleDto {
  userId: string;
  deviceIdentifier?: string;
  ruleName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface UpdateTimeRuleDto {
  ruleName?: string;
  enabled?: boolean;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
}

export interface CreatePresetDto {
  userId: string;
  deviceIdentifier?: string;
  presetType: TimeRulePreset;
}

const asRule = (fields: Partial<UserTimeRule>): UserTimeRule =>
  Object.assign(new UserTimeRule(), fields);

@Injectable()
export class TimeRuleService {
  private readonly logger = new Logger(TimeRuleService.name);

  constructor(
    @InjectRepository(UserTimeRule)
    private readonly timeRuleRepository: Repository<UserTimeRule>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async createTimeRule(createDto: CreateTimeRuleDto): Promise<UserTimeRule> {
    await this.assertSchedulable(
      asRule(createDto),
      (name) =>
        `Rule overlaps with existing rule "${name}" on the same day and time`,
    );

    return this.timeRuleRepository.save(
      this.timeRuleRepository.create({ ...createDto }),
    );
  }

  async createPreset(createDto: CreatePresetDto): Promise<UserTimeRule[]> {
    this.logger.log(
      `Creating preset: ${createDto.presetType} for user ${createDto.userId}`,
    );

    const rules = presetRules(createDto.presetType);

    try {
      if (rules.length === 0) {
        throw new Error(`Invalid preset type: ${createDto.presetType}`);
      }

      const createdRules = await serialTransaction(
        this.dataSource.manager,
        async (manager) => {
          await manager.delete(UserTimeRule, {
            userId: createDto.userId,
            deviceIdentifier: createDto.deviceIdentifier || IsNull(),
          });

          const saved: UserTimeRule[] = [];
          for (const rule of rules) {
            saved.push(
              await manager.save(
                manager.create(UserTimeRule, {
                  ...rule,
                  userId: createDto.userId,
                  deviceIdentifier: createDto.deviceIdentifier || undefined,
                  enabled: true,
                }),
              ),
            );
          }
          return saved;
        },
      );

      this.logger.log(
        `Successfully created ${createdRules.length} preset rules`,
      );
      return createdRules;
    } catch (error) {
      this.logger.error(
        `Error creating preset: ${errorMessage(error)}`,
        asHttpError(error).stack,
      );
      throw new Error(`Failed to create preset: ${errorMessage(error)}`);
    }
  }

  async getTimeRules(
    userId: string,
    deviceIdentifier?: string,
  ): Promise<UserTimeRule[]> {
    return this.timeRuleRepository.find({
      where: { userId, deviceIdentifier: deviceIdentifier || IsNull() },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async getAllTimeRules(userId: string): Promise<UserTimeRule[]> {
    return this.timeRuleRepository.find({
      where: { userId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async updateTimeRule(
    userId: string,
    ruleId: number,
    updateDto: UpdateTimeRuleDto,
  ): Promise<UserTimeRule | null> {
    const rule = await this.findOwnedRule(userId, ruleId);

    if (
      updateDto.dayOfWeek !== undefined ||
      updateDto.startTime ||
      updateDto.endTime
    ) {
      await this.assertSchedulable(
        asRule({ ...rule, ...updateDto }),
        (name) => `Updated rule would overlap with existing rule "${name}"`,
      );
    }

    Object.assign(rule, updateDto);
    return this.timeRuleRepository.save(rule);
  }

  async deleteTimeRule(userId: string, ruleId: number): Promise<void> {
    const rule = await this.findOwnedRule(userId, ruleId);
    await this.timeRuleRepository.remove(rule);
  }

  async toggleTimeRule(userId: string, ruleId: number): Promise<UserTimeRule> {
    const rule = await this.findOwnedRule(userId, ruleId);
    rule.enabled = !rule.enabled;
    return this.timeRuleRepository.save(rule);
  }

  async checkStreamingAllowed(
    userId: string,
    deviceIdentifier?: string,
    currentTime?: Date,
  ): Promise<{ allowed: boolean; reason: string }> {
    const clock = readClock(
      currentTime ?? (await this.configService.getCurrentTimeInTimezone()),
    );

    const deviceRules = deviceIdentifier
      ? await this.getTimeRules(userId, deviceIdentifier)
      : [];
    const userRules = await this.getTimeRules(userId);

    const blockingRule = [...deviceRules, ...userRules].find(
      (rule) => rule.enabled && isScheduleActive(rule, clock),
    );

    if (blockingRule) {
      return {
        allowed: false,
        reason: `Blocked by rule "${blockingRule.ruleName}" (${blockingRule.startTime}-${blockingRule.endTime})`,
      };
    }

    return { allowed: true, reason: 'No time restrictions apply' };
  }

  private async findOwnedRule(
    userId: string,
    ruleId: number,
  ): Promise<UserTimeRule> {
    const rule = await this.timeRuleRepository.findOne({
      where: { id: ruleId, userId },
    });

    if (!rule) {
      throw new NotFoundException('Time rule not found');
    }

    return rule;
  }

  private async assertSchedulable(
    candidate: UserTimeRule,
    overlapMessage: (ruleName: string) => string,
  ): Promise<void> {
    if (!candidate.validateTimeRange()) {
      throw new BadRequestException(
        'End time must be greater than start time. A rule cannot cross midnight; split it into one rule ending at 23:59 and one starting at 00:00 on the next day',
      );
    }

    if (
      !Number.isInteger(candidate.dayOfWeek) ||
      candidate.dayOfWeek < 0 ||
      candidate.dayOfWeek > 6
    ) {
      throw new BadRequestException(
        'Day of week must be between 0 (Sunday) and 6 (Saturday)',
      );
    }

    const clash = (await this.getAllTimeRules(candidate.userId)).find(
      (existing) => candidate.overlaps(existing),
    );
    if (clash) {
      throw new ConflictException(overlapMessage(clash.ruleName));
    }
  }
}
