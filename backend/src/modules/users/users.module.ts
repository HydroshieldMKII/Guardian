import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from '@/modules/users/users.controller';
import { RuleController } from '@/modules/users/controllers/rule.controller';
import { UsersService } from '@/modules/users/services/users.service';
import { PlexUserSyncService } from '@/modules/users/services/plex-user-sync.service';
import { TimeRuleService } from '@/modules/users/services/time-rule.service';
import { TimePolicyService } from '@/modules/users/services/time-policy.service';
import { ConcurrentStreamService } from '@/modules/users/services/concurrent-stream.service';
import { UserPreference } from '@/entities/user-preference.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { UserTimeRule } from '@/entities/user-time-rule.entity';
import { ConfigModule } from '@/modules/config/config.module';
import { PlexModule } from '@/modules/plex/plex.module';
import { DeviceTrackingModule } from '@/modules/devices/services/device-tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPreference, UserDevice, UserTimeRule]),
    forwardRef(() => ConfigModule),
    forwardRef(() => PlexModule),
    forwardRef(() => DeviceTrackingModule),
  ],
  controllers: [UsersController, RuleController],
  providers: [
    UsersService,
    PlexUserSyncService,
    TimeRuleService,
    TimePolicyService,
    ConcurrentStreamService,
  ],
  exports: [
    UsersService,
    PlexUserSyncService,
    TimeRuleService,
    TimePolicyService,
    ConcurrentStreamService,
  ],
})
export class UsersModule {}
