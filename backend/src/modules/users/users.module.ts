import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { TimeRuleController } from './controllers/time-rule.controller';
import { TimeRuleBatchController } from '../time-rules/time-rule-batch.controller';
import { UsersService } from './services/users.service';
import { TimeRuleService } from './services/time-rule.service';
import { TimePolicyService } from './services/time-policy.service';
import { UserPreference } from '../../entities/user-preference.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { UserTimeRule } from '../../entities/user-time-rule.entity';
import { ConfigModule } from '../config/config.module';
import { PlexModule } from '../plex/plex.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPreference, UserDevice, UserTimeRule]),
    forwardRef(() => ConfigModule),
    forwardRef(() => PlexModule),
  ],
  controllers: [UsersController, TimeRuleController, TimeRuleBatchController],
  providers: [UsersService, TimeRuleService, TimePolicyService],
  exports: [UsersService, TimeRuleService, TimePolicyService],
})
export class UsersModule {}
