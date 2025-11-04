import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { NotificationOrchestratorService } from './services/notification-orchestrator.service';
import { Notification } from '../../entities/notification.entity';
import { SessionHistory } from '../../entities/session-history.entity';
import { UserPreference } from '../../entities/user-preference.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      SessionHistory,
      UserPreference,
      UserDevice,
    ]),
    ConfigModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationOrchestratorService],
  exports: [NotificationsService, NotificationOrchestratorService],
})
export class NotificationsModule {}
