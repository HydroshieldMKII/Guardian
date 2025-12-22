import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { TimeRuleService } from '../services/time-rule.service';
import type {
  CreateTimeRuleDto,
  UpdateTimeRuleDto,
  CreatePresetDto,
} from '../services/time-rule.service';
import { UserTimeRule } from '../../../entities/user-time-rule.entity';
import { AdminOnly } from '../../auth/decorators/admin-only.decorator';

export interface BatchTimeRulesDto {
  userIds: string[];
}

@Controller()
@AdminOnly()
export class RuleController {
  private readonly logger = new Logger(RuleController.name);

  constructor(private readonly timeRuleService: TimeRuleService) {}

  // Batch endpoint for fetching multiple users' rules
  @Post('rules/batch')
  async getTimeRulesBatch(
    @Body() dto: BatchTimeRulesDto,
  ): Promise<Record<string, UserTimeRule[]>> {
    const result: Record<string, UserTimeRule[]> = {};

    // Fetch time rules for each user
    for (const userId of dto.userIds) {
      try {
        const rules = await this.timeRuleService.getAllTimeRules(userId);
        result[userId] = rules;
      } catch (error) {
        this.logger.error(
          `Error fetching time rules for user ${userId}`,
          error?.stack || error,
        );
        result[userId] = []; // Return empty on error
      }
    }

    return result;
  }

  @Post('users/:userId/rules')
  async createTimeRule(
    @Param('userId') userId: string,
    @Body() createDto: Omit<CreateTimeRuleDto, 'userId'>,
  ): Promise<UserTimeRule> {
    return this.timeRuleService.createTimeRule({
      ...createDto,
      userId,
    });
  }

  @Get('users/:userId/rules')
  async getTimeRules(
    @Param('userId') userId: string,
    @Query('deviceIdentifier') deviceIdentifier?: string,
  ): Promise<UserTimeRule[]> {
    return this.timeRuleService.getTimeRules(userId, deviceIdentifier);
  }

  @Get('users/:userId/rules/all')
  async getAllTimeRules(
    @Param('userId') userId: string,
  ): Promise<UserTimeRule[]> {
    return this.timeRuleService.getAllTimeRules(userId);
  }

  @Get('users/:userId/rules/device/:deviceIdentifier')
  async getTimeRulesForDevice(
    @Param('userId') userId: string,
    @Param('deviceIdentifier') deviceIdentifier: string,
  ): Promise<UserTimeRule[]> {
    return this.timeRuleService.getTimeRules(userId, deviceIdentifier);
  }

  @Put('users/:userId/rules/:ruleId')
  async updateTimeRule(
    @Param('userId') userId: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @Body() updateDto: UpdateTimeRuleDto,
  ): Promise<UserTimeRule | null> {
    return this.timeRuleService.updateTimeRule(userId, ruleId, updateDto);
  }

  @Put('users/:userId/rules/:ruleId/toggle')
  async toggleTimeRule(
    @Param('userId') userId: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ): Promise<UserTimeRule> {
    return this.timeRuleService.toggleTimeRule(userId, ruleId);
  }

  @Delete('users/:userId/rules/:ruleId')
  async deleteTimeRule(
    @Param('userId') userId: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ): Promise<void> {
    return this.timeRuleService.deleteTimeRule(userId, ruleId);
  }

  @Get('users/:userId/rules/check')
  async checkStreamingAllowed(
    @Param('userId') userId: string,
    @Query('deviceIdentifier') deviceIdentifier?: string,
  ): Promise<{ allowed: boolean; reason: string }> {
    return this.timeRuleService.checkStreamingAllowed(userId, deviceIdentifier);
  }

  @Post('users/:userId/rules/preset')
  async createPreset(
    @Param('userId') userId: string,
    @Body() createDto: Omit<CreatePresetDto, 'userId'>,
  ): Promise<UserTimeRule[]> {
    try {
      return await this.timeRuleService.createPreset({
        ...createDto,
        userId,
      });
    } catch (error) {
      this.logger.error(
        `Controller error creating preset: ${error.message}`,
        error?.stack,
      );
      throw new HttpException(
        error.message || 'Failed to create preset',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
