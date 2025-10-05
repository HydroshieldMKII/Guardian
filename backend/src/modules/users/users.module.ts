import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './services/users.service';
import { UserPreference } from '../../entities/user-preference.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { ConfigModule } from '../config/config.module';
import { PlexModule } from '../plex/plex.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPreference, UserDevice]),
    forwardRef(() => ConfigModule),
    forwardRef(() => PlexModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
