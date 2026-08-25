import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDevice } from '@/entities/user-device.entity';
import { UserTimeRule } from '@/entities/user-time-rule.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { AppSettings } from '@/entities/app-settings.entity';
import { UserPortalService } from '@/modules/user-portal/services/user-portal.service';
import { UserPortalController } from '@/modules/user-portal/user-portal.controller';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { ConfigModule } from '@/modules/config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserDevice,
      UserTimeRule,
      UserPreference,
      AppSettings,
    ]),
    forwardRef(() => NotificationsModule),
    ConfigModule,
  ],
  providers: [UserPortalService],
  controllers: [UserPortalController],
  exports: [UserPortalService],
})
export class UserPortalModule {}
