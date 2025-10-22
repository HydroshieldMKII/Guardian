import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigController } from './config.controller';
import { ConfigService } from './services/config.service';
import { EmailService } from './services/email.service';
import { EmailTemplateService } from './services/email-template.service';
import { PlexConnectionService } from './services/plex-connection.service';
import { TimezoneService } from './services/timezone.service';
import { DatabaseService } from './services/database.service';
import { VersionService } from './services/version.service';
import { AppSettings } from '../../entities/app-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppSettings])],
  controllers: [ConfigController],
  providers: [
    ConfigService,
    EmailService,
    EmailTemplateService,
    PlexConnectionService,
    TimezoneService,
    DatabaseService,
    VersionService,
  ],
  exports: [
    ConfigService,
    EmailService,
    EmailTemplateService,
    PlexConnectionService,
    TimezoneService,
    DatabaseService,
    VersionService,
  ],
})
export class ConfigModule {}
