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
import { UserPreference } from '../../entities/user-preference.entity';

interface UpdateUserPreferenceDto {
  defaultBlock: boolean | null;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAllUsers(): Promise<any[]> {
    return await this.usersService.getAllUsers();
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
}
