import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './services/users.service';
import { UserPreference } from '../../entities/user-preference.entity';
import { UserDevice } from '../../entities/user-device.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserPreference, UserDevice])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
