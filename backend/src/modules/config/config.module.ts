import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigController } from '@/modules/config/config.controller';
import { ConfigService } from '@/modules/config/services/config.service';
import { EmailService } from '@/modules/config/services/email.service';
import { EmailTemplateService } from '@/modules/config/services/email-template.service';
import { PlexConnectionService } from '@/modules/config/services/plex-connection.service';
import { TimezoneService } from '@/modules/config/services/timezone.service';
import { DatabaseService } from '@/modules/config/services/database.service';
import { VersionService } from '@/modules/config/services/version.service';
import { AppriseService } from '@/modules/config/services/apprise.service';
import { AppSettings } from '@/entities/app-settings.entity';
import { Session } from '@/entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppSettings, Session])],
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
