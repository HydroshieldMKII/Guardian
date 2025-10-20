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

export interface BatchTimeRulesDto {
  userIds: string[];
}

@Controller()
export class TimeRuleController {
  private readonly logger = new Logger(TimeRuleController.name);

  constructor(private readonly timeRuleService: TimeRuleService) {}

  // Batch endpoint for fetching multiple users' time rules
  @Post('time-rules/batch')
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

  @Post('users/:userId/time-rules')
  async createTimeRule(
    @Param('userId') userId: string,
    @Body() createDto: Omit<CreateTimeRuleDto, 'userId'>,
  ): Promise<UserTimeRule> {
    return this.timeRuleService.createTimeRule({
      ...createDto,
      userId,
    });
  }

  @Get('users/:userId/time-rules')
  async getTimeRules(
    @Param('userId') userId: string,
    @Query('deviceIdentifier') deviceIdentifier?: string,
  ): Promise<UserTimeRule[]> {
    return this.timeRuleService.getTimeRules(userId, deviceIdentifier);
  }

  @Get('users/:userId/time-rules/all')
  async getAllTimeRules(
    @Param('userId') userId: string,
  ): Promise<UserTimeRule[]> {
    return this.timeRuleService.getAllTimeRules(userId);
  }

  @Get('users/:userId/time-rules/device/:deviceIdentifier')
  async getTimeRulesForDevice(
    @Param('userId') userId: string,
    @Param('deviceIdentifier') deviceIdentifier: string,
  ): Promise<UserTimeRule[]> {
    return this.timeRuleService.getTimeRules(userId, deviceIdentifier);
  }

  @Put('users/:userId/time-rules/:ruleId')
  async updateTimeRule(
    @Param('userId') userId: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @Body() updateDto: UpdateTimeRuleDto,
  ): Promise<UserTimeRule | null> {
    return this.timeRuleService.updateTimeRule(userId, ruleId, updateDto);
  }

  @Put('users/:userId/time-rules/:ruleId/toggle')
  async toggleTimeRule(
    @Param('userId') userId: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ): Promise<UserTimeRule> {
    return this.timeRuleService.toggleTimeRule(userId, ruleId);
  }

  @Delete('users/:userId/time-rules/:ruleId')
  async deleteTimeRule(
    @Param('userId') userId: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ): Promise<void> {
    return this.timeRuleService.deleteTimeRule(userId, ruleId);
  }

  @Get('users/:userId/time-rules/check')
  async checkStreamingAllowed(
    @Param('userId') userId: string,
    @Query('deviceIdentifier') deviceIdentifier?: string,
  ): Promise<{ allowed: boolean; reason: string }> {
    return this.timeRuleService.checkStreamingAllowed(userId, deviceIdentifier);
  }

  @Post('users/:userId/time-rules/preset')
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
