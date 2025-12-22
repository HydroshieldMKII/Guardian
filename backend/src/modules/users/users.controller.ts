import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './services/users.service';
import { ConcurrentStreamService } from './services/concurrent-stream.service';
import { UserPreference } from '../../entities/user-preference.entity';

interface UpdateUserPreferenceDto {
  defaultBlock: boolean | null;
}

interface UpdateUserIPPolicyDto {
  networkPolicy?: 'both' | 'lan' | 'wan';
  ipAccessPolicy?: 'all' | 'restricted';
  allowedIPs?: string[];
}

interface UpdateConcurrentStreamLimitDto {
  concurrentStreamLimit: number | null;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly concurrentStreamService: ConcurrentStreamService,
  ) {}

  @Get()
  async getAllUsers(): Promise<any[]> {
    return await this.usersService.getAllUsers();
  }

  @Get('hidden/list')
  async getHiddenUsers(): Promise<UserPreference[]> {
    return await this.usersService.getHiddenUsers();
  }

  @Get(':userId')
  async getUserPreference(
    @Param('userId') userId: string,
  ): Promise<UserPreference | null> {
    return this.usersService.getUserPreference(userId);
  }

  @Post(':userId/preference')
  @HttpCode(HttpStatus.OK)
  async updateUserPreference(
    @Param('userId') userId: string,
    @Body() updateUserPreferenceDto: UpdateUserPreferenceDto,
  ): Promise<{ message: string; preference: UserPreference }> {
    const preference = await this.usersService.updateUserPreference(
      userId,
      updateUserPreferenceDto.defaultBlock,
    );

    return {
      message: 'User preference updated successfully',
      preference,
    };
  }

  @Post(':userId/hide')
  @HttpCode(HttpStatus.OK)
  async hideUser(
    @Param('userId') userId: string,
  ): Promise<{ message: string; preference: UserPreference }> {
    const preference = await this.usersService.hideUser(userId);

    return {
      message: 'User hidden successfully',
      preference,
    };
  }

  @Post(':userId/show')
  @HttpCode(HttpStatus.OK)
  async showUser(
    @Param('userId') userId: string,
  ): Promise<{ message: string; preference: UserPreference }> {
    const preference = await this.usersService.showUser(userId);

    return {
      message: 'User shown successfully',
      preference,
    };
  }

  @Post(':userId/toggle-visibility')
  @HttpCode(HttpStatus.OK)
  async toggleUserVisibility(
    @Param('userId') userId: string,
  ): Promise<{ message: string; preference: UserPreference }> {
    const preference = await this.usersService.toggleUserVisibility(userId);

    return {
      message: `User ${preference.hidden ? 'hidden' : 'shown'} successfully`,
      preference,
    };
  }

  @Post(':userId/ip-policy')
  @HttpCode(HttpStatus.OK)
  async updateUserIPPolicy(
    @Param('userId') userId: string,
    @Body() updateIPPolicyDto: UpdateUserIPPolicyDto,
  ): Promise<{ message: string; preference: UserPreference }> {
    const preference = await this.usersService.updateUserIPPolicy(
      userId,
      updateIPPolicyDto,
    );

    return {
      message: 'User IP policy updated successfully',
      preference,
    };
  }

  @Post(':userId/concurrent-stream-limit')
  @HttpCode(HttpStatus.OK)
  async updateConcurrentStreamLimit(
    @Param('userId') userId: string,
    @Body() dto: UpdateConcurrentStreamLimitDto,
  ): Promise<{ message: string; preference: UserPreference }> {
    const preference = await this.usersService.updateConcurrentStreamLimit(
      userId,
      dto.concurrentStreamLimit,
    );

    return {
      message: 'User concurrent stream limit updated successfully',
      preference,
    };
  }

  @Get(':userId/concurrent-stream-info')
  async getConcurrentStreamInfo(@Param('userId') userId: string): Promise<{
    limit: number | null;
    effectiveLimit: number;
    isUnlimited: boolean;
    isOverridden: boolean;
  }> {
    const preference = await this.usersService.getUserPreference(userId);
    const effectiveLimit =
      await this.concurrentStreamService.getEffectiveLimit(userId);

    return {
      limit: preference?.concurrentStreamLimit ?? null,
      effectiveLimit,
      isUnlimited: effectiveLimit === 0,
      isOverridden: preference?.concurrentStreamLimit !== null,
    };
  }
}
