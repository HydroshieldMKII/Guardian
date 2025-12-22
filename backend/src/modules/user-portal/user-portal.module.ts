import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDevice } from '../../entities/user-device.entity';
import { UserTimeRule } from '../../entities/user-time-rule.entity';
import { UserPreference } from '../../entities/user-preference.entity';
import { AppSettings } from '../../entities/app-settings.entity';
import { UserPortalService } from './services/user-portal.service';
import { UserPortalController } from './user-portal.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserDevice, UserTimeRule, UserPreference, AppSettings])],
  providers: [UserPortalService],
  controllers: [UserPortalController],
  exports: [UserPortalService],
})
export class UserPortalModule {}
