import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Post,
  HttpException,
  HttpStatus,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ConfigService, ConfigSettingDto } from './services/config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('version')
  async getVersion() {
    try {
      return await this.configService.getVersionInfo();
    } catch (error) {
      throw new HttpException(
        'Failed to get version information',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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

  @Get('plex/status')
  async getPlexStatus() {
    try {
      const status = await this.configService.getPlexConfigurationStatus();
      return status;
    } catch (error) {
      throw new HttpException(
        'Failed to get Plex status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('database/export')
  async exportDatabase(@Res() res: Response) {
    try {
      const exportData = await this.configService.exportDatabase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `guardian-backup-${timestamp}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);
    } catch (error) {
      throw new HttpException(
        'Failed to export database',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('database/import')
  @UseInterceptors(FileInterceptor('file'))
  async importDatabase(@UploadedFile() file: any) {
    try {
      if (!file) {
        throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
      }

      const fileContent = file.buffer.toString('utf8');
      let importData;
      
      try {
        importData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new HttpException('Invalid JSON file', HttpStatus.BAD_REQUEST);
      }

      const result = await this.configService.importDatabase(importData);
      return {
        message: 'Database imported successfully',
        imported: result,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to import database',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('scripts/reset-database')
  async resetDatabase() {
    try {
      await this.configService.resetDatabase();
      return { message: 'Database reset successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to reset database',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('scripts/reset-stream-counts')
  async resetStreamCounts() {
    try {
      await this.configService.resetStreamCounts();
      return { message: 'Stream counts reset successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to reset stream counts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('scripts/delete-all-devices')
  async deleteAllDevices() {
    try {
      await this.configService.deleteAllDevices();
      return { message: 'All devices deleted successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete all devices',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('scripts/clear-session-history')
  async clearSessionHistory() {
    try {
      await this.configService.clearAllSessionHistory();
      return { message: 'Session history cleared successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to clear session history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
