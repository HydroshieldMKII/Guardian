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
} from '@nestjs/common';
import { TimeRuleService } from '../services/time-rule.service';
import type {
  CreateTimeRuleDto,
  UpdateTimeRuleDto,
  CreatePresetDto,
} from '../services/time-rule.service';
import { UserTimeRule } from '../../../entities/user-time-rule.entity';

@Controller('users/:userId/time-rules')
export class TimeRuleController {
  constructor(private readonly timeRuleService: TimeRuleService) {}

  @Post()
  async createTimeRule(
    @Param('userId') userId: string,
    @Body() createDto: Omit<CreateTimeRuleDto, 'userId'>,
  ): Promise<UserTimeRule> {
    return this.timeRuleService.createTimeRule({
      ...createDto,
      userId,
    });
  }

  @Get()
  async getTimeRules(
    @Param('userId') userId: string,
    @Query('deviceIdentifier') deviceIdentifier?: string,
  ): Promise<UserTimeRule[]> {
    return this.timeRuleService.getTimeRules(userId, deviceIdentifier);
  }

  @Get('all')
  async getAllTimeRules(
    @Param('userId') userId: string,
  ): Promise<UserTimeRule[]> {
    return this.timeRuleService.getAllTimeRules(userId);
  }

  @Get('device/:deviceIdentifier')
  async getTimeRulesForDevice(
    @Param('userId') userId: string,
    @Param('deviceIdentifier') deviceIdentifier: string,
  ): Promise<UserTimeRule[]> {
    return this.timeRuleService.getTimeRules(userId, deviceIdentifier);
  }

  @Put(':ruleId')
  async updateTimeRule(
    @Param('userId') userId: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @Body() updateDto: UpdateTimeRuleDto,
  ): Promise<UserTimeRule | null> {
    return this.timeRuleService.updateTimeRule(userId, ruleId, updateDto);
  }

  @Put(':ruleId/toggle')
  async toggleTimeRule(
    @Param('userId') userId: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ): Promise<UserTimeRule> {
    return this.timeRuleService.toggleTimeRule(userId, ruleId);
  }

  @Delete(':ruleId')
  async deleteTimeRule(
    @Param('userId') userId: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ): Promise<void> {
    return this.timeRuleService.deleteTimeRule(userId, ruleId);
  }

  @Get('check')
  async checkStreamingAllowed(
    @Param('userId') userId: string,
    @Query('deviceIdentifier') deviceIdentifier?: string,
  ): Promise<{ allowed: boolean; reason: string }> {
    return this.timeRuleService.checkStreamingAllowed(userId, deviceIdentifier);
  }

  @Post('preset')
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
      console.error(`Controller error creating preset: ${error.message}`);
      throw new HttpException(
        error.message || 'Failed to create preset',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
