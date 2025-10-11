import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { Notification } from '../../entities/notification.entity';
import { SessionHistory } from '../../entities/session-history.entity';
import { UserPreference } from '../../entities/user-preference.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, SessionHistory, UserPreference]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}