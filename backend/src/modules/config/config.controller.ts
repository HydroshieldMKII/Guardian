import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Post,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService, ConfigSettingDto } from './services/config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async getAllSettings() {
    try {
      return await this.configService.getPublicSettings();
    } catch (error) {
      throw new HttpException(
        'Failed to fetch settings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':key')
  async getSetting(@Param('key') key: string) {
    try {
      const value = await this.configService.getSetting(key);
      if (value === null) {
        throw new HttpException('Setting not found', HttpStatus.NOT_FOUND);
      }
      return { key, value };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Failed to fetch setting',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':key')
  async updateSetting(@Param('key') key: string, @Body() body: { value: any }) {
    try {
      const updated = await this.configService.updateSetting(key, body.value);
      return { message: 'Setting updated successfully', setting: updated };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update setting',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put()
  async updateMultipleSettings(@Body() settings: ConfigSettingDto[]) {
    try {
      const updated = await this.configService.updateMultipleSettings(settings);
      return {
        message: 'Settings updated successfully',
        settings: updated,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update settings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('test-plex-connection')
  async testPlexConnection() {
    try {
      const result = await this.configService.testPlexConnection();
      return result;
    } catch (error) {
      throw new HttpException(
        'Failed to test connection',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
