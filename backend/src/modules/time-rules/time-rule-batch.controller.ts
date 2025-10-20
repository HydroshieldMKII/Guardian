import { Controller, Post, Body } from '@nestjs/common';
import { TimeRuleService } from '../users/services/time-rule.service';
import { UserTimeRule } from '../../entities/user-time-rule.entity';

export interface BatchTimeRulesDto {
  userIds: string[];
}

@Controller('time-rules')
export class TimeRuleBatchController {
  constructor(private readonly timeRuleService: TimeRuleService) {}

  @Post('batch')
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
        console.error(`Error fetching time rules for user ${userId}:`, error);
        result[userId] = []; // Return empty array on error
      }
    }

    return result;
  }
}
