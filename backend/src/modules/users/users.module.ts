import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { TimeRuleController } from './controllers/time-rule.controller';
import { UsersService } from './services/users.service';
import { TimeRuleService } from './services/time-rule.service';
import { TimePolicyService } from './services/time-policy.service';
import { ConcurrentStreamService } from './services/concurrent-stream.service';
import { UserPreference } from '../../entities/user-preference.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { UserTimeRule } from '../../entities/user-time-rule.entity';
import { ConfigModule } from '../config/config.module';
import { PlexModule } from '../plex/plex.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPreference, UserDevice, UserTimeRule]),
    forwardRef(() => ConfigModule),
    forwardRef(() => PlexModule),
    forwardRef(() => DevicesModule),
  ],
  controllers: [UsersController, TimeRuleController],
  providers: [
    UsersService,
    TimeRuleService,
    TimePolicyService,
    ConcurrentStreamService,
  ],
  exports: [
    UsersService,
    TimeRuleService,
    TimePolicyService,
    ConcurrentStreamService,
  ],
})
export class UsersModule {}
