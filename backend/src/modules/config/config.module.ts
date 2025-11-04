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
import { AppriseService } from './services/apprise.service';
import { AppSettings } from '../../entities/app-settings.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([AppSettings]), AuthModule],
  controllers: [ConfigController],
  providers: [
    ConfigService,
    EmailService,
    EmailTemplateService,
    PlexConnectionService,
    TimezoneService,
    DatabaseService,
    VersionService,
    AppriseService,
  ],
  exports: [
    ConfigService,
    EmailService,
    EmailTemplateService,
    PlexConnectionService,
    TimezoneService,
    DatabaseService,
    VersionService,
    AppriseService,
  ],
})
export class ConfigModule {}
