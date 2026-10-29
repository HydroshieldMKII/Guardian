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
import { ConfigService } from '@/modules/config/services/config.service';
import { ConfigSettingDto } from '@/modules/config/dto/config-setting.dto';
import { UpdateSettingDto } from '@/modules/config/dto/update-setting.dto';
import { configSettingsPipe } from '@/modules/config/dto/config-settings.pipe';
import { ConnectionTestService } from '@/modules/config/services/connection-test.service';
import { isSettingKey } from '@/modules/config/settings.catalog';
import { AdminOnly } from '@/modules/auth/decorators/admin-only.decorator';
import { respondOrFail } from '@/common/utils/respond-or-fail';

const settingNotFound = () =>
  new HttpException('Setting not found', HttpStatus.NOT_FOUND);

@Controller('config')
@AdminOnly()
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private readonly connectionTest: ConnectionTestService,
  ) {}

  @Get('version')
  getVersion() {
    return respondOrFail(
      () => this.configService.getVersionInfo(),
      'Failed to get version information',
    );
  }

  @Get()
  getAllSettings() {
    return respondOrFail(
      () => this.configService.getPublicSettings(),
      'Failed to fetch settings',
    );
  }

  @Get(':key')
  getSetting(@Param('key') key: string) {
    return respondOrFail(async () => {
      if (!isSettingKey(key)) throw settingNotFound();

      const setting = await this.configService.getPublicSetting(key);
      if (!setting) throw settingNotFound();
      return { key, value: setting.value };
    }, 'Failed to fetch setting');
  }

  @Put(':key')
  updateSetting(@Param('key') key: string, @Body() body: UpdateSettingDto) {
    return respondOrFail(
      async () => {
        if (!isSettingKey(key)) throw settingNotFound();

        const updated = await this.configService.updateSetting(key, body.value);
        return { message: 'Setting updated successfully', setting: updated };
      },
      'Failed to update setting',
      { status: HttpStatus.BAD_REQUEST, exposeCause: true },
    );
  }

  @Put()
  updateMultipleSettings(
    @Body(configSettingsPipe) settings: ConfigSettingDto[],
  ) {
    return respondOrFail(
      async () => ({
        message: 'Settings updated successfully',
        settings: await this.configService.updateMultipleSettings(settings),
      }),
      'Failed to update settings',
      { status: HttpStatus.BAD_REQUEST, exposeCause: true },
    );
  }

  @Post('test-plex-connection')
  testPlexConnection() {
    return respondOrFail(
      () => this.connectionTest.testPlexConnection(),
      'Failed to test connection',
    );
  }

  @Post('test-smtp-connection')
  testSMTPConnection() {
    return respondOrFail(
      () => this.connectionTest.testSMTPConnection(),
      'Failed to test SMTP connection',
    );
  }

  @Post('test-apprise-connection')
  testAppriseConnection() {
    return respondOrFail(
      () => this.connectionTest.testAppriseConnection(),
      'Failed to test Apprise connection',
    );
  }

  @Get('plex/status')
  getPlexStatus() {
    return respondOrFail(
      () => this.connectionTest.getPlexConfigurationStatus(),
      'Failed to get Plex status',
    );
  }
}
